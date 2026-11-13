import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { formatMoney } from "@/lib/money";
import { fail, ok, type Result } from "@/lib/result";
import { effectivePriceMinor } from "@/lib/sale";
import { qualifiesForPriceAlert } from "@/lib/wishlist";
import { db } from "../db/client";
import {
  productMedia,
  products,
  users,
  variants,
  wishlistAlerts,
  wishlistItems,
  wishlists,
} from "../db/schema";
import { mailer } from "../mail";

export type WishlistSummary = {
  id: string;
  name: string;
  isDefault: boolean;
  itemCount: number;
};

export type WishlistList = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type WishlistItemView = {
  variantId: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  productStatus: "draft" | "active" | "archived";
  variantTitle: string;
  priceMinor: number;
  currentPriceMinor: number;
  onSale: boolean;
  available: boolean;
  stockQty: number;
  addedPriceMinor: number;
  imageKey: string | null;
  imageAlt: string;
  createdAt: Date;
};

export type WishlistStateForProduct = {
  lists: WishlistList[];
  memberships: Record<string, string[]>;
};

const DEFAULT_LIST_NAME = "Saved";

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

async function findDefaultWishlist(userId: string) {
  const [row] = await db
    .select()
    .from(wishlists)
    .where(and(eq(wishlists.userId, userId), eq(wishlists.isDefault, true)))
    .limit(1);
  return row ?? null;
}

/** The default list is created lazily and is safe under concurrent requests. */
export async function ensureDefaultWishlist(userId: string) {
  const existing = await findDefaultWishlist(userId);
  if (existing) return existing;

  await db
    .insert(wishlists)
    .values({ userId, name: DEFAULT_LIST_NAME, isDefault: true })
    .onConflictDoNothing();

  const created = await findDefaultWishlist(userId);
  if (!created) throw new Error("Could not create the default wishlist.");
  return created;
}

export async function listWishlists(userId: string): Promise<WishlistSummary[]> {
  await ensureDefaultWishlist(userId);

  return db
    .select({
      id: wishlists.id,
      name: wishlists.name,
      isDefault: wishlists.isDefault,
      itemCount: sql<number>`count(${wishlistItems.variantId})::int`,
    })
    .from(wishlists)
    .leftJoin(wishlistItems, eq(wishlistItems.wishlistId, wishlists.id))
    .where(eq(wishlists.userId, userId))
    .groupBy(wishlists.id, wishlists.name, wishlists.isDefault)
    .orderBy(desc(wishlists.isDefault), asc(wishlists.name));
}

export async function getWishlist(
  userId: string,
  wishlistId: string,
): Promise<WishlistList | null> {
  const [row] = await db
    .select({ id: wishlists.id, name: wishlists.name, isDefault: wishlists.isDefault })
    .from(wishlists)
    .where(and(eq(wishlists.id, wishlistId), eq(wishlists.userId, userId)))
    .limit(1);

  return row ?? null;
}

async function nameTaken(userId: string, name: string, exceptId?: string): Promise<boolean> {
  const [row] = await db
    .select({ id: wishlists.id })
    .from(wishlists)
    .where(
      and(
        eq(wishlists.userId, userId),
        sql`lower(${wishlists.name}) = lower(${name})`,
      ),
    )
    .limit(1);

  return Boolean(row && row.id !== exceptId);
}

export async function createWishlist(
  userId: string,
  inputName: string,
): Promise<Result<WishlistList>> {
  const name = cleanName(inputName);
  if (name.length < 1) return fail("Give the list a name.");
  if (name.length > 60) return fail("Keep the list name under 60 characters.");
  if (await nameTaken(userId, name)) return fail("You already have a list with that name.");

  const [created] = await db
    .insert(wishlists)
    .values({ userId, name })
    .returning({ id: wishlists.id, name: wishlists.name, isDefault: wishlists.isDefault });

  if (!created) return fail("Could not create the list.");
  return ok(created);
}

export async function renameWishlist(
  userId: string,
  wishlistId: string,
  inputName: string,
): Promise<Result<WishlistList>> {
  const name = cleanName(inputName);
  if (name.length < 1) return fail("Give the list a name.");
  if (name.length > 60) return fail("Keep the list name under 60 characters.");
  if (!(await getWishlist(userId, wishlistId))) {
    return fail("That wishlist could not be found.");
  }
  if (await nameTaken(userId, name, wishlistId)) {
    return fail("You already have a list with that name.");
  }

  const [updated] = await db
    .update(wishlists)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(wishlists.id, wishlistId), eq(wishlists.userId, userId)))
    .returning({ id: wishlists.id, name: wishlists.name, isDefault: wishlists.isDefault });

  if (!updated) return fail("That wishlist could not be found.");
  return ok(updated);
}

async function cleanupOrphanAlerts(userId: string): Promise<void> {
  await db.execute(sql`
    delete from ${wishlistAlerts}
    where ${wishlistAlerts.userId} = ${userId}
      and not exists (
        select 1
        from ${wishlistItems}
        inner join ${wishlists} on ${wishlists.id} = ${wishlistItems.wishlistId}
        where ${wishlists.userId} = ${userId}
          and ${wishlistItems.variantId} = ${wishlistAlerts.variantId}
      )
  `);
}

export async function deleteWishlist(
  userId: string,
  wishlistId: string,
): Promise<Result<{ deleted: true }>> {
  const wishlist = await getWishlist(userId, wishlistId);
  if (!wishlist) return fail("That wishlist could not be found.");
  if (wishlist.isDefault) return fail("The default Saved list cannot be deleted.");

  await db
    .delete(wishlists)
    .where(and(eq(wishlists.id, wishlistId), eq(wishlists.userId, userId)));
  await cleanupOrphanAlerts(userId);

  return ok({ deleted: true });
}

export async function listWishlistItems(
  userId: string,
  wishlistId: string,
  now = new Date(),
): Promise<WishlistItemView[]> {
  const wishlist = await getWishlist(userId, wishlistId);
  if (!wishlist) return [];

  const rows = await db
    .select({
      variantId: variants.id,
      variantTitle: variants.title,
      variantActive: variants.active,
      priceMinor: variants.priceMinor,
      salePriceMinor: variants.salePriceMinor,
      saleStartsAt: variants.saleStartsAt,
      saleEndsAt: variants.saleEndsAt,
      stockQty: variants.stockQty,
      productId: products.id,
      productSlug: products.slug,
      productTitle: products.title,
      productStatus: products.status,
      addedPriceMinor: wishlistItems.addedPriceMinor,
      createdAt: wishlistItems.createdAt,
    })
    .from(wishlistItems)
    .innerJoin(variants, eq(variants.id, wishlistItems.variantId))
    .innerJoin(products, eq(products.id, variants.productId))
    .where(eq(wishlistItems.wishlistId, wishlistId))
    .orderBy(desc(wishlistItems.createdAt));

  if (rows.length === 0) return [];

  const productIds = [...new Set(rows.map((row) => row.productId))];
  const mediaRows = await db
    .select({
      productId: productMedia.productId,
      storageKey: productMedia.storageKey,
      alt: productMedia.alt,
    })
    .from(productMedia)
    .where(inArray(productMedia.productId, productIds))
    .orderBy(asc(productMedia.position));

  const firstImage = new Map<string, { storageKey: string; alt: string }>();
  for (const media of mediaRows) {
    if (!firstImage.has(media.productId)) {
      firstImage.set(media.productId, { storageKey: media.storageKey, alt: media.alt });
    }
  }

  return rows.map((row) => {
    const currentPriceMinor = effectivePriceMinor(row.priceMinor, row, now);
    return {
      variantId: row.variantId,
      productId: row.productId,
      productSlug: row.productSlug,
      productTitle: row.productTitle,
      productStatus: row.productStatus,
      variantTitle: row.variantTitle,
      priceMinor: row.priceMinor,
      currentPriceMinor,
      onSale: currentPriceMinor < row.priceMinor,
      available:
        row.productStatus === "active" && row.variantActive && row.stockQty > 0,
      stockQty: row.stockQty,
      addedPriceMinor: row.addedPriceMinor,
      imageKey: firstImage.get(row.productId)?.storageKey ?? null,
      imageAlt: firstImage.get(row.productId)?.alt ?? row.productTitle,
      createdAt: row.createdAt,
    };
  });
}

export async function removeWishlistItem(
  userId: string,
  wishlistId: string,
  variantId: string,
): Promise<Result<{ removed: true }>> {
  const wishlist = await getWishlist(userId, wishlistId);
  if (!wishlist) return fail("That wishlist could not be found.");

  const [deleted] = await db
    .delete(wishlistItems)
    .where(
      and(
        eq(wishlistItems.wishlistId, wishlistId),
        eq(wishlistItems.variantId, variantId),
      ),
    )
    .returning();

  if (!deleted) return fail("That item is not in this list.");

  await cleanupOrphanAlerts(userId);
  return ok({ removed: true });
}

export async function setVariantWishlists(
  userId: string,
  variantId: string,
  wishlistIds: string[],
  now = new Date(),
): Promise<Result<{ listIds: string[] }>> {
  const selected = [...new Set(wishlistIds.filter(Boolean))];

  const [variant] = await db
    .select()
    .from(variants)
    .where(eq(variants.id, variantId))
    .limit(1);
  if (!variant) return fail("That variant could not be found.");

  if (selected.length > 0) {
    const owned = await db
      .select({ id: wishlists.id })
      .from(wishlists)
      .where(and(eq(wishlists.userId, userId), inArray(wishlists.id, selected)));

    if (owned.length !== selected.length) {
      return fail("One of those lists no longer exists.");
    }
  }

  const currentRows = await db
    .select({ wishlistId: wishlistItems.wishlistId })
    .from(wishlistItems)
    .innerJoin(wishlists, eq(wishlists.id, wishlistItems.wishlistId))
    .where(and(eq(wishlists.userId, userId), eq(wishlistItems.variantId, variantId)));

  const current = new Set(currentRows.map((row) => row.wishlistId));
  const desired = new Set(selected);
  const addedPriceMinor = effectivePriceMinor(variant.priceMinor, variant, now);

  await db.transaction(async (tx) => {
    for (const wishlistId of desired) {
      if (current.has(wishlistId)) continue;
      await tx
        .insert(wishlistItems)
        .values({ wishlistId, variantId, addedPriceMinor })
        .onConflictDoNothing();
    }

    for (const wishlistId of current) {
      if (desired.has(wishlistId)) continue;
      await tx
        .delete(wishlistItems)
        .where(
          and(
            eq(wishlistItems.wishlistId, wishlistId),
            eq(wishlistItems.variantId, variantId),
          ),
        );
    }
  });

  await cleanupOrphanAlerts(userId);
  return ok({ listIds: selected });
}

export async function getWishlistStateForProduct(
  userId: string,
  productId: string,
): Promise<WishlistStateForProduct> {
  await ensureDefaultWishlist(userId);

  const [lists, variantRows] = await Promise.all([
    db
      .select({ id: wishlists.id, name: wishlists.name, isDefault: wishlists.isDefault })
      .from(wishlists)
      .where(eq(wishlists.userId, userId))
      .orderBy(desc(wishlists.isDefault), asc(wishlists.name)),
    db.select({ id: variants.id }).from(variants).where(eq(variants.productId, productId)),
  ]);

  const variantIds = variantRows.map((row) => row.id);
  const memberships: Record<string, string[]> = {};
  if (variantIds.length > 0) {
    const rows = await db
      .select({ variantId: wishlistItems.variantId, wishlistId: wishlistItems.wishlistId })
      .from(wishlistItems)
      .innerJoin(wishlists, eq(wishlists.id, wishlistItems.wishlistId))
      .where(
        and(eq(wishlists.userId, userId), inArray(wishlistItems.variantId, variantIds)),
      );

    for (const row of rows) {
      const list = memberships[row.variantId] ?? [];
      list.push(row.wishlistId);
      memberships[row.variantId] = list;
    }
  }

  return { lists, memberships };
}

type AlertRow = {
  userId: string;
  userEmail: string;
  userName: string;
  variantId: string;
  variantTitle: string;
  variantActive: boolean;
  priceMinor: number;
  salePriceMinor: number | null;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
  productId: string;
  productSlug: string;
  productTitle: string;
  productStatus: "draft" | "active" | "archived";
  addedPriceMinor: number;
  alertSentAt: Date | null;
};

async function evaluatePriceAlerts(
  conditions: ReturnType<typeof eq>[],
  now: Date,
): Promise<void> {
  const query = db
    .select({
      userId: wishlists.userId,
      userEmail: users.email,
      userName: users.name,
      variantId: variants.id,
      variantTitle: variants.title,
      variantActive: variants.active,
      priceMinor: variants.priceMinor,
      salePriceMinor: variants.salePriceMinor,
      saleStartsAt: variants.saleStartsAt,
      saleEndsAt: variants.saleEndsAt,
      productId: products.id,
      productSlug: products.slug,
      productTitle: products.title,
      productStatus: products.status,
      addedPriceMinor: wishlistItems.addedPriceMinor,
      alertSentAt: wishlistAlerts.sentAt,
    })
    .from(wishlistItems)
    .innerJoin(wishlists, eq(wishlists.id, wishlistItems.wishlistId))
    .innerJoin(users, eq(users.id, wishlists.userId))
    .innerJoin(variants, eq(variants.id, wishlistItems.variantId))
    .innerJoin(products, eq(products.id, variants.productId))
    .leftJoin(
      wishlistAlerts,
      and(
        eq(wishlistAlerts.userId, wishlists.userId),
        eq(wishlistAlerts.variantId, wishlistItems.variantId),
      ),
    )
    .where(and(...conditions));

  const rows: AlertRow[] = await query;
  const groups = new Map<string, AlertRow[]>();

  for (const row of rows) {
    const key = `${row.userId}:${row.variantId}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const baseUrl = process.env.NEXT_PUBLIC_STORE_URL ?? "http://localhost:3000";

  for (const group of groups.values()) {
    const first = group[0];
    if (!first) continue;
    if (first.productStatus !== "active" || !first.variantActive) continue;

    const currentPriceMinor = effectivePriceMinor(first.priceMinor, first, now);
    const addedPrices = group.map((row) => row.addedPriceMinor);
    if (
      !qualifiesForPriceAlert(
        addedPrices,
        currentPriceMinor,
        group.some((row) => row.alertSentAt !== null),
      )
    ) {
      continue;
    }

    const [claimed] = await db
      .insert(wishlistAlerts)
      .values({ userId: first.userId, variantId: first.variantId })
      .onConflictDoNothing()
      .returning();

    if (!claimed) continue;

    const savedAtMinor = Math.max(...addedPrices);
    try {
      await mailer.send({
        to: first.userEmail,
        subject: `Price drop: ${first.productTitle}`,
        text: [
          `Good news — a saved item is now cheaper.`,
          ``,
          `${first.productTitle} — ${first.variantTitle}`,
          `Now: ${formatMoney(currentPriceMinor)}`,
          `Saved at: ${formatMoney(savedAtMinor)}`,
          ``,
          `View it: ${baseUrl}/products/${first.productSlug}`,
          ``,
          `You receive this because you saved this item. Remove it from your wishlist to stop alerts.`,
        ].join("\n"),
      });
    } catch (error) {
      await db
        .delete(wishlistAlerts)
        .where(
          and(
            eq(wishlistAlerts.userId, first.userId),
            eq(wishlistAlerts.variantId, first.variantId),
          ),
        );
      console.error("wishlist price-drop mail failed", error);
    }
  }
}

export async function checkWishlistPriceDropsForUser(
  userId: string,
  now = new Date(),
): Promise<void> {
  await evaluatePriceAlerts([eq(wishlists.userId, userId)], now);
}

export async function checkWishlistPriceDropsForProduct(
  userId: string,
  productId: string,
  now = new Date(),
): Promise<void> {
  await evaluatePriceAlerts(
    [eq(wishlists.userId, userId), eq(products.id, productId)],
    now,
  );
}

export async function checkWishlistPriceDropsForVariant(
  variantId: string,
  now = new Date(),
): Promise<void> {
  await evaluatePriceAlerts([eq(wishlistItems.variantId, variantId)], now);
}

export async function checkWishlistPriceDropsForVariants(
  variantIds: string[],
  now = new Date(),
): Promise<void> {
  const unique = [...new Set(variantIds.filter(Boolean))];
  if (unique.length === 0) return;
  await evaluatePriceAlerts([inArray(wishlistItems.variantId, unique)], now);
}
