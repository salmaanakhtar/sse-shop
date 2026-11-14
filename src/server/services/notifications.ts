import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { fail, ok, type Result } from "@/lib/result";
import { formatMoney } from "@/lib/money";
import { db } from "../db/client";
import {
  abandonedCartEmails,
  cartItems,
  carts,
  lowStockAlerts,
  products,
  stockAlerts,
  users,
  variants,
} from "../db/schema";
import { mailer } from "../mail";
import { getStoreSettings } from "./settings";

const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

const storeUrl = () => process.env.NEXT_PUBLIC_STORE_URL ?? "http://localhost:3000";

export async function subscribeToStockAlert(input: {
  variantId: string;
  email: string;
  userId?: string | null;
}): Promise<Result<{ status: "subscribed" | "in_stock" }>> {
  const email = emailSchema.safeParse(input.email);
  if (!email.success) {
    return fail(email.error.issues[0]?.message ?? "Enter a valid email address.");
  }

  const [variant] = await db
    .select({
      id: variants.id,
      stockQty: variants.stockQty,
      active: variants.active,
      productTitle: products.title,
      productSlug: products.slug,
      productStatus: products.status,
    })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .where(eq(variants.id, input.variantId))
    .limit(1);

  if (!variant || variant.productStatus !== "active" || !variant.active) {
    return fail("That item is no longer available.");
  }
  if (variant.stockQty > 0) {
    return ok({ status: "in_stock" });
  }

  await db
    .insert(stockAlerts)
    .values({
      variantId: variant.id,
      email: email.data,
      userId: input.userId ?? null,
    })
    .onConflictDoUpdate({
      target: [stockAlerts.variantId, stockAlerts.email],
      set: {
        userId: input.userId ?? null,
        consentAt: new Date(),
        notifiedAt: null,
      },
    });

  return ok({ status: "subscribed" });
}

async function sendBackInStockAlerts(
  variant: {
    id: string;
    productTitle: string;
    productSlug: string;
    variantTitle: string;
    priceMinor: number;
  },
  stockQty: number,
): Promise<number> {
  const pending = await db
    .select()
    .from(stockAlerts)
    .where(and(eq(stockAlerts.variantId, variant.id), isNull(stockAlerts.notifiedAt)));

  let sent = 0;
  for (const alert of pending) {
    try {
      await mailer.send({
        to: alert.email,
        subject: `${variant.productTitle} is back in stock`,
        text: [
          `Good news — ${variant.productTitle} (${variant.variantTitle}) is back.`,
          ``,
          `${stockQty} in stock · ${formatMoney(variant.priceMinor)}`,
          ``,
          `Shop it: ${storeUrl()}/products/${variant.productSlug}`,
          ``,
          `You asked for one email when this item returned. No further alerts will be sent.`,
        ].join("\n"),
      });
      await db
        .update(stockAlerts)
        .set({ notifiedAt: new Date() })
        .where(eq(stockAlerts.id, alert.id));
      sent += 1;
    } catch (error) {
      console.error("back-in-stock mail failed", error);
    }
  }

  return sent;
}

async function sendLowStockAlert(variant: {
  id: string;
  productTitle: string;
  productSlug: string;
  variantTitle: string;
  sku: string;
  stockQty: number;
}): Promise<boolean> {
  const [row] = await db
    .insert(lowStockAlerts)
    .values({ variantId: variant.id, stockQty: variant.stockQty })
    .onConflictDoNothing()
    .returning({ id: lowStockAlerts.id });

  // Already alerted for this crossing; nothing to send.
  if (!row) return false;

  const settings = await getStoreSettings();
  try {
    await mailer.send({
      to: settings.contactEmail,
      subject: `Low stock: ${variant.productTitle} — ${variant.variantTitle}`,
      text: [
        `${variant.productTitle} (${variant.variantTitle}) is down to ${variant.stockQty}.`,
        ``,
        `SKU: ${variant.sku}`,
        `Edit the product: ${storeUrl()}/admin/products`,
        ``,
        `One alert is sent per crossing. Restock above the threshold to reset it.`,
      ].join("\n"),
    });
    return true;
  } catch (error) {
    // Keep the crossing retryable when delivery fails.
    await db.delete(lowStockAlerts).where(eq(lowStockAlerts.variantId, variant.id));
    console.error("low-stock mail failed", error);
    return false;
  }
}

/**
 * Called after any mutation that changes stock. It sends back-in-stock mail for
 * variants that just became available, opens low-stock alerts, and clears the
 * alert row for variants back above their threshold. Safe to call repeatedly.
 */
export async function processStockChanges(
  variantIds: readonly string[],
): Promise<{ backInStock: number; lowStock: number }> {
  const ids = [...new Set(variantIds)];
  if (ids.length === 0) return { backInStock: 0, lowStock: 0 };

  const settings = await getStoreSettings();

  const rows = await db
    .select({
      id: variants.id,
      stockQty: variants.stockQty,
      lowStockThreshold: variants.lowStockThreshold,
      variantTitle: variants.title,
      sku: variants.sku,
      priceMinor: variants.priceMinor,
      productTitle: products.title,
      productSlug: products.slug,
    })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .where(inArray(variants.id, ids));

  let backInStock = 0;
  let lowStock = 0;

  for (const variant of rows) {
    if (variant.stockQty > 0) {
      backInStock += await sendBackInStockAlerts(variant, variant.stockQty);
    }

    const threshold = variant.lowStockThreshold ?? settings.lowStockThreshold;
    if (variant.stockQty > threshold) {
      await db.delete(lowStockAlerts).where(eq(lowStockAlerts.variantId, variant.id));
    } else if (await sendLowStockAlert(variant)) {
      lowStock += 1;
    }
  }

  return { backInStock, lowStock };
}

export async function listPendingStockAlerts(limit = 50) {
  return db
    .select({
      id: stockAlerts.id,
      email: stockAlerts.email,
      createdAt: stockAlerts.createdAt,
      variantTitle: variants.title,
      productTitle: products.title,
    })
    .from(stockAlerts)
    .innerJoin(variants, eq(variants.id, stockAlerts.variantId))
    .innerJoin(products, eq(products.id, variants.productId))
    .where(isNull(stockAlerts.notifiedAt))
    .orderBy(desc(stockAlerts.createdAt))
    .limit(limit);
}

export async function countPendingStockAlerts(): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(stockAlerts)
    .where(isNull(stockAlerts.notifiedAt));
  return row?.value ?? 0;
}

/**
 * Signed-in carts only, with marketing consent, quiet for the configured
 * number of hours, and not already emailed. One message per cart.
 */
export async function sendAbandonedCartEmails(): Promise<{ sent: number; eligible: number }> {
  const settings = await getStoreSettings();
  const cutoff = new Date(Date.now() - settings.abandonedCartHours * 60 * 60 * 1000);

  const candidates = await db
    .select({
      id: carts.id,
      userId: users.id,
      email: users.email,
      name: users.name,
    })
    .from(carts)
    .innerJoin(users, eq(users.id, carts.userId))
    .innerJoin(cartItems, eq(cartItems.cartId, carts.id))
    .leftJoin(abandonedCartEmails, eq(abandonedCartEmails.cartId, carts.id))
    .where(
      and(
        eq(users.marketingConsent, true),
        isNull(users.deletedAt),
        gt(carts.expiresAt, new Date()),
        isNull(abandonedCartEmails.id),
      ),
    )
    .groupBy(carts.id, carts.updatedAt, users.id, users.email, users.name)
    .having(
      sql`greatest(${carts.updatedAt}, coalesce(max(${cartItems.updatedAt}), ${carts.updatedAt})) < ${cutoff.toISOString()}::timestamptz`,
    );

  let sent = 0;
  for (const candidate of candidates) {
    const items = await db
      .select({
        title: products.title,
        variantTitle: variants.title,
        quantity: cartItems.quantity,
        priceMinor: variants.priceMinor,
      })
      .from(cartItems)
      .innerJoin(variants, eq(variants.id, cartItems.variantId))
      .innerJoin(products, eq(products.id, variants.productId))
      .where(eq(cartItems.cartId, candidate.id));

    if (items.length === 0) continue;

    try {
      await mailer.send({
        to: candidate.email,
        subject: "Still thinking it over?",
        text: [
          `Hi ${candidate.name || "there"},`,
          ``,
          `Your cart is still here:`,
          ...items.map(
            (item) =>
              `· ${item.quantity} × ${item.title} (${item.variantTitle}) — ${formatMoney(item.priceMinor * item.quantity)}`,
          ),
          ``,
          `Return to your cart: ${storeUrl()}/cart`,
          ``,
          `Sign in on this device if it is new; your cart will be restored to your account.`,
          ``,
          `You are receiving this because you opted in to store emails. Unsubscribe from your account preferences.`,
        ].join("\n"),
      });
      await db
        .insert(abandonedCartEmails)
        .values({ cartId: candidate.id, userId: candidate.userId })
        .onConflictDoNothing();
      sent += 1;
    } catch (error) {
      console.error("abandoned-cart mail failed", error);
    }
  }

  return { sent, eligible: candidates.length };
}

export async function countAbandonedCarts(): Promise<number> {
  const settings = await getStoreSettings();
  const cutoff = new Date(Date.now() - settings.abandonedCartHours * 60 * 60 * 1000);

  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(
      db
        .select({ id: carts.id })
        .from(carts)
        .innerJoin(users, eq(users.id, carts.userId))
        .innerJoin(cartItems, eq(cartItems.cartId, carts.id))
        .leftJoin(abandonedCartEmails, eq(abandonedCartEmails.cartId, carts.id))
        .where(
          and(
            eq(users.marketingConsent, true),
            isNull(users.deletedAt),
            gt(carts.expiresAt, new Date()),
            isNull(abandonedCartEmails.id),
          ),
        )
        .groupBy(carts.id, carts.updatedAt)
        .having(
          sql`greatest(${carts.updatedAt}, coalesce(max(${cartItems.updatedAt}), ${carts.updatedAt})) < ${cutoff.toISOString()}::timestamptz`,
        )
        .as("eligible"),
    );

  return row?.value ?? 0;
}
