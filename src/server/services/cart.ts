import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { priceCart, type CartTotals } from "@/lib/pricing";
import { fail, ok, type Result } from "@/lib/result";
import { effectivePriceMinor } from "@/lib/sale";
import { getAuthSession } from "../auth/guard";
import { db } from "../db/client";
import {
  cartItems,
  carts,
  productMedia,
  products,
  variants,
} from "../db/schema";
import { getStoreSettings } from "./settings";
import { getVariantPathLabels } from "./variant-tree";

export const CART_COOKIE = "sse_cart";
const CART_TTL_SECONDS = 60 * 60 * 24 * 30;
const MAX_LINE_QUANTITY = 99;

export type CartLine = {
  itemId: string;
  variantId: string;
  productTitle: string;
  productSlug: string;
  variantTitle: string;
  optionLabel: string;
  unitPriceMinor: number;
  regularPriceMinor: number;
  quantity: number;
  stockQty: number;
  lineTotalMinor: number;
  imageKey: string | null;
  available: boolean;
};

export type CartView = {
  id: string;
  lines: CartLine[];
  totals: CartTotals;
  currency: "AED";
  itemCount: number;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function expiresAt(): Date {
  return new Date(Date.now() + CART_TTL_SECONDS * 1000);
}

/**
 * The raw token lives only in the cookie; the database stores its hash, so a
 * database read cannot be replayed as a shopping session.
 */
async function readToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

async function findLiveCart(token: string) {
  const hash = hashToken(token);
  const [cart] = await db.select().from(carts).where(eq(carts.tokenHash, hash)).limit(1);
  if (!cart) return null;
  if (cart.expiresAt.getTime() < Date.now()) return null;
  return cart;
}

async function requireCartId(): Promise<string | null> {
  const token = await readToken();
  if (!token) return null;
  const cart = await findLiveCart(token);
  return cart?.id ?? null;
}

async function currentUserId(): Promise<string | null> {
  const session = await getAuthSession();
  return session?.user.id ?? null;
}

/**
 * Creates the cart on first mutation. Pages never call this: a server component
 * cannot set a cookie, and an empty cookie-less cart is just "no cart".
 */
async function ensureCartId(): Promise<string> {
  const userId = await currentUserId();
  const token = await readToken();
  if (token) {
    const existing = await findLiveCart(token);
    if (existing) {
      // A shopper can add to cart before signing in, then sign in on the same
      // browser. The cart becomes theirs without losing its contents.
      if (userId && !existing.userId) {
        await db
          .update(carts)
          .set({ userId, updatedAt: new Date() })
          .where(eq(carts.id, existing.id));
      }
      return existing.id;
    }
  }

  const newToken = randomBytes(32).toString("base64url");
  const [created] = await db
    .insert(carts)
    .values({ tokenHash: hashToken(newToken), userId, expiresAt: expiresAt() })
    .returning({ id: carts.id });

  if (!created) throw new Error("could not create a cart");

  const store = await cookies();
  store.set({
    name: CART_COOKIE,
    value: newToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_TTL_SECONDS,
  });

  return created.id;
}

/**
 * After sign-in, the browser's anonymous cart becomes the customer's cart. If
 * they already have a cart from another device, the two are merged by variant,
 * capped at current stock, and the browser keeps one cookie for the result.
 */
export async function mergeCartOnSignIn(userId: string): Promise<void> {
  const token = await readToken();
  const liveCart = token ? await findLiveCart(token) : null;

  // A cart already owned by a different account is not ours to merge. Expire it
  // and let the next add-to-cart start a fresh anonymous cart.
  if (liveCart?.userId && liveCart.userId !== userId) {
    await db
      .update(carts)
      .set({ expiresAt: new Date(0) })
      .where(eq(carts.id, liveCart.id));
    (await cookies()).delete(CART_COOKIE);
    return;
  }

  const anonymousCart = liveCart;
  const userCarts = await db
    .select()
    .from(carts)
    .where(and(eq(carts.userId, userId), gt(carts.expiresAt, new Date())))
    .orderBy(desc(carts.updatedAt));

  const otherUserCarts = userCarts.filter((cart) => cart.id !== anonymousCart?.id);

  if (!anonymousCart && otherUserCarts.length === 0) return;

  // Keep the anonymous cart when there is one: its raw token is already in the
  // cookie. Otherwise adopt the most recently used account cart and rotate its
  // token so this browser can address it.
  const target = anonymousCart ?? otherUserCarts[0];
  if (!target) return;

  const mergedSources = anonymousCart ? otherUserCarts : otherUserCarts.slice(1);
  const keptToken = anonymousCart ? token : randomBytes(32).toString("base64url");
  if (!keptToken) return;

  await db.transaction(async (tx) => {
    const sourceIds = [target.id, ...mergedSources.map((cart) => cart.id)];
    const items = await tx
      .select()
      .from(cartItems)
      .where(inArray(cartItems.cartId, sourceIds));

    const quantityByVariant = new Map<string, number>();
    for (const item of items) {
      const current = quantityByVariant.get(item.variantId) ?? 0;
      quantityByVariant.set(item.variantId, current + item.quantity);
    }

    const variantIds = [...quantityByVariant.keys()];
    const variantRows =
      variantIds.length > 0
        ? await tx
            .select({ id: variants.id, stockQty: variants.stockQty })
            .from(variants)
            .where(inArray(variants.id, variantIds))
        : [];

    const stockByVariant = new Map(variantRows.map((row) => [row.id, row.stockQty]));

    await tx.delete(cartItems).where(inArray(cartItems.cartId, sourceIds));

    const merged = [...quantityByVariant.entries()]
      .map(([variantId, quantity]) => ({
        cartId: target.id,
        variantId,
        quantity: Math.min(quantity, stockByVariant.get(variantId) ?? 0, MAX_LINE_QUANTITY),
      }))
      .filter((row) => row.quantity > 0);

    if (merged.length > 0) {
      await tx.insert(cartItems).values(merged);
    }

    if (mergedSources.length > 0) {
      await tx
        .update(carts)
        .set({ expiresAt: new Date(0), updatedAt: new Date() })
        .where(inArray(carts.id, mergedSources.map((cart) => cart.id)));
    }

    await tx
      .update(carts)
      .set({
        userId,
        tokenHash: anonymousCart ? target.tokenHash : hashToken(keptToken),
        expiresAt: expiresAt(),
        updatedAt: new Date(),
      })
      .where(eq(carts.id, target.id));
  });

  if (!anonymousCart) {
    const store = await cookies();
    store.set({
      name: CART_COOKIE,
      value: keptToken,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: CART_TTL_SECONDS,
    });
  }
}

export async function getCartView(): Promise<CartView | null> {
  const cartId = await requireCartId();
  if (!cartId) return null;
  return loadCart(cartId);
}

export async function loadCart(cartId: string): Promise<CartView> {
  const settings = await getStoreSettings();

  const rows = await db
    .select({
      itemId: cartItems.id,
      quantity: cartItems.quantity,
      variantId: variants.id,
      variantTitle: variants.title,
      priceMinor: variants.priceMinor,
      salePriceMinor: variants.salePriceMinor,
      saleStartsAt: variants.saleStartsAt,
      saleEndsAt: variants.saleEndsAt,
      stockQty: variants.stockQty,
      variantActive: variants.active,
      productId: products.id,
      productTitle: products.title,
      productSlug: products.slug,
      productStatus: products.status,
    })
    .from(cartItems)
    .innerJoin(variants, eq(cartItems.variantId, variants.id))
    .innerJoin(products, eq(variants.productId, products.id))
    .where(eq(cartItems.cartId, cartId))
    .orderBy(asc(cartItems.createdAt));

  const productIds = [...new Set(rows.map((row) => row.productId))];

  const [labelsByVariant, mediaRows] = await Promise.all([
    getVariantPathLabels(productIds),
    productIds.length > 0
      ? db
          .select()
          .from(productMedia)
          .where(inArray(productMedia.productId, productIds))
          .orderBy(asc(productMedia.position))
      : Promise.resolve([]),
  ]);

  const imageByProduct = new Map<string, string>();
  for (const media of mediaRows) {
    if (!imageByProduct.has(media.productId)) {
      imageByProduct.set(media.productId, media.storageKey);
    }
  }

  const now = new Date();
  const lines: CartLine[] = rows.map((row) => {
    const unitPriceMinor = effectivePriceMinor(row.priceMinor, row, now);

    return {
      itemId: row.itemId,
      variantId: row.variantId,
      productTitle: row.productTitle,
      productSlug: row.productSlug,
      variantTitle: row.variantTitle,
      optionLabel: (labelsByVariant.get(row.variantId) ?? []).join(" / "),
      unitPriceMinor,
      regularPriceMinor: row.priceMinor,
      quantity: row.quantity,
      stockQty: row.stockQty,
      lineTotalMinor: unitPriceMinor * row.quantity,
      imageKey: imageByProduct.get(row.productId) ?? null,
      available:
        row.variantActive && row.productStatus === "active" && row.stockQty >= row.quantity,
    };
  });

  const totals = priceCart({
    lines: lines.map((line) => ({ unitPriceMinor: line.unitPriceMinor, quantity: line.quantity })),
    shipping: {
      flatRateMinor: settings.shippingFlatRateMinor,
      freeThresholdMinor: settings.shippingFreeThresholdMinor,
    },
    taxRateBp: settings.taxRateBp,
  });

  return {
    id: cartId,
    lines,
    totals,
    currency: "AED",
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

export async function getCartItemCount(): Promise<number> {
  const cartId = await requireCartId();
  if (!cartId) return 0;

  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${cartItems.quantity}), 0)::int` })
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId));

  return row?.total ?? 0;
}

export async function addToCart(
  variantId: string,
  quantity: number,
): Promise<Result<{ cartCount: number }>> {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
    return fail("Choose a quantity between 1 and 99.");
  }

  const [variant] = await db
    .select({
      id: variants.id,
      stockQty: variants.stockQty,
      active: variants.active,
      productStatus: products.status,
    })
    .from(variants)
    .innerJoin(products, eq(variants.productId, products.id))
    .where(eq(variants.id, variantId))
    .limit(1);

  if (!variant || !variant.active || variant.productStatus !== "active") {
    return fail("That item is no longer available.");
  }

  const cartId = await ensureCartId();

  const [existing] = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, variantId)))
    .limit(1);

  const desired = (existing?.quantity ?? 0) + quantity;
  if (desired > variant.stockQty) {
    return fail(
      variant.stockQty === 0
        ? "That item is sold out."
        : `Only ${variant.stockQty} left in stock.`,
    );
  }

  if (existing) {
    await db
      .update(cartItems)
      .set({ quantity: desired, updatedAt: new Date() })
      .where(eq(cartItems.id, existing.id));
  } else {
    await db.insert(cartItems).values({ cartId, variantId, quantity });
  }

  return ok({ cartCount: await getCartItemCount() });
}

export async function setCartItemQuantity(
  itemId: string,
  quantity: number,
): Promise<Result<{ removed: boolean }>> {
  const cartId = await requireCartId();
  if (!cartId) return fail("Your cart has expired.");

  if (quantity <= 0) {
    const removed = await removeCartItem(itemId);
    return removed.ok ? ok({ removed: true }) : removed;
  }

  if (!Number.isInteger(quantity) || quantity > MAX_LINE_QUANTITY) {
    return fail("Choose a quantity between 1 and 99.");
  }

  const [item] = await db
    .select({ id: cartItems.id, variantId: cartItems.variantId, stockQty: variants.stockQty })
    .from(cartItems)
    .innerJoin(variants, eq(cartItems.variantId, variants.id))
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)))
    .limit(1);

  if (!item) return fail("That item is not in your cart.");
  if (quantity > item.stockQty) return fail(`Only ${item.stockQty} left in stock.`);

  await db
    .update(cartItems)
    .set({ quantity, updatedAt: new Date() })
    .where(eq(cartItems.id, item.id));

  return ok({ removed: false });
}

export async function removeCartItem(itemId: string): Promise<Result<{ removed: true }>> {
  const cartId = await requireCartId();
  if (!cartId) return fail("Your cart has expired.");

  const deleted = await db
    .delete(cartItems)
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)))
    .returning({ id: cartItems.id });

  if (deleted.length === 0) return fail("That item is not in your cart.");
  return ok({ removed: true });
}

export async function readCartIdForCheckout(): Promise<string | null> {
  return requireCartId();
}
