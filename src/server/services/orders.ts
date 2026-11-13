import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { addressSchema, type Address } from "@/lib/address";
import { priceCart } from "@/lib/pricing";
import { fail, ok, type Result } from "@/lib/result";
import { db } from "../db/client";
import {
  auditLog,
  cartItems,
  carts,
  counters,
  orderItems,
  orders,
  products,
  variants,
} from "../db/schema";
import { mailer } from "../mail";
import { paymentProvider } from "../payments";
import { readCartIdForCheckout } from "./cart";
import { getStoreSettings } from "./settings";

export type { Address };

const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

export type PlacedOrder = {
  number: string;
  lookupToken: string;
  totalMinor: number;
  paymentStatus: "paid" | "failed";
};

export type OrderLineView = {
  sku: string;
  title: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
};

export type OrderView = {
  number: string;
  email: string;
  status: string;
  paymentStatus: string;
  placedAt: Date;
  subtotalMinor: number;
  shippingMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  currency: string;
  userId: string | null;
  shippingAddress: Address;
  billingAddress: Address | null;
  notes: string | null;
  items: OrderLineView[];
};

export type CustomerOrderSummary = {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  placedAt: Date;
  totalMinor: number;
  itemCount: number;
};

class CheckoutError extends Error {
  constructor(readonly userMessage: string) {
    super(userMessage);
  }
}

const ORDER_COUNTER = "order_number";
/** Long enough for a delivery dispute, short enough that a forwarded link rots. */
const LOOKUP_TTL_DAYS = 90;

async function nextOrderNumber(tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) {
  await tx.insert(counters).values({ key: ORDER_COUNTER, value: 0 }).onConflictDoNothing();

  const [row] = await tx
    .update(counters)
    .set({ value: sql`${counters.value} + 1`, updatedAt: new Date() })
    .where(eq(counters.key, ORDER_COUNTER))
    .returning({ value: counters.value });

  const sequence = row?.value ?? 1;
  return `SS-${new Date().getFullYear()}-${String(sequence).padStart(6, "0")}`;
}

function newLookupToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}

export function hashLookupToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function placeOrder(input: {
  email: string;
  address: Address;
  billingAddress?: Address | null;
  expectedTotalMinor: number;
  /** Server-derived session user; never trust a client-supplied id. */
  userId?: string | null;
}): Promise<Result<PlacedOrder>> {
  const email = emailSchema.safeParse(input.email);
  if (!email.success) return fail(email.error.issues[0]?.message ?? "Enter a valid email address.");

  const address = addressSchema.safeParse(input.address);
  if (!address.success) {
    return fail(address.error.issues[0]?.message ?? "Check the delivery address.");
  }

  let billingAddress: Address | null = null;
  if (input.billingAddress) {
    const billing = addressSchema.safeParse(input.billingAddress);
    if (!billing.success) {
      return fail(billing.error.issues[0]?.message ?? "Check the billing address.");
    }
    billingAddress = billing.data;
  }

  const cartId = await readCartIdForCheckout();
  if (!cartId) return fail("Your cart is empty.");

  const settings = await getStoreSettings();
  const lookup = newLookupToken();

  type Committed = {
    orderId: string;
    number: string;
    subtotalMinor: number;
    shippingMinor: number;
    discountMinor: number;
    taxMinor: number;
    totalMinor: number;
    lines: { variantId: string; sku: string; title: string; unitPriceMinor: number; quantity: number }[];
  };

  let committed: Committed;

  try {
    committed = await db.transaction(async (tx) => {
      // Lock the cart so two submissions cannot both consume it.
      const [cart] = await tx
        .select()
        .from(carts)
        .where(eq(carts.id, cartId))
        .for("update")
        .limit(1);

      if (!cart || cart.expiresAt.getTime() < Date.now()) {
        throw new CheckoutError("Your cart has expired. Please add your items again.");
      }

      const items = await tx.select().from(cartItems).where(eq(cartItems.cartId, cartId));
      if (items.length === 0) throw new CheckoutError("Your cart is empty.");

      // Sorted ids give a deterministic lock order, so two concurrent checkouts
      // cannot deadlock each other on overlapping variants.
      const variantIds = [...items.map((item) => item.variantId)].sort();

      const locked = await tx
        .select({
          variantId: variants.id,
          sku: variants.sku,
          variantTitle: variants.title,
          priceMinor: variants.priceMinor,
          stockQty: variants.stockQty,
          active: variants.active,
          productTitle: products.title,
          productStatus: products.status,
        })
        .from(variants)
        .innerJoin(products, eq(variants.productId, products.id))
        .where(inArray(variants.id, variantIds))
        .orderBy(asc(variants.id))
        .for("update");

      const byId = new Map(locked.map((row) => [row.variantId, row]));
      const lines: Committed["lines"] = [];

      for (const item of items) {
        const variant = byId.get(item.variantId);
        if (!variant || !variant.active || variant.productStatus !== "active") {
          throw new CheckoutError("An item in your cart is no longer available.");
        }
        if (variant.stockQty < item.quantity) {
          throw new CheckoutError(
            variant.stockQty === 0
              ? `${variant.productTitle} just sold out.`
              : `Only ${variant.stockQty} of ${variant.productTitle} left in stock.`,
          );
        }
        lines.push({
          variantId: variant.variantId,
          sku: variant.sku,
          title: `${variant.productTitle} — ${variant.variantTitle}`,
          unitPriceMinor: variant.priceMinor,
          quantity: item.quantity,
        });
      }

      const totals = priceCart({
        lines: lines.map((line) => ({
          unitPriceMinor: line.unitPriceMinor,
          quantity: line.quantity,
        })),
        shipping: {
          flatRateMinor: settings.shippingFlatRateMinor,
          freeThresholdMinor: settings.shippingFreeThresholdMinor,
        },
        taxRateBp: settings.taxRateBp,
      });

      // The shopper agreed to a number. If it moved, stop rather than charge
      // something they never saw.
      if (totals.totalMinor !== input.expectedTotalMinor) {
        throw new CheckoutError(
          "Prices changed while you were checking out. Please review your cart.",
        );
      }

      const number = await nextOrderNumber(tx);

      const [order] = await tx
        .insert(orders)
        .values({
          number,
          lookupTokenHash: lookup.hash,
          lookupExpiresAt: new Date(Date.now() + LOOKUP_TTL_DAYS * 24 * 60 * 60 * 1000),
          userId: input.userId ?? null,
          email: email.data,
          status: "pending",
          paymentStatus: "unpaid",
          currency: "AED",
          subtotalMinor: totals.subtotalMinor,
          shippingMinor: totals.shippingMinor,
          discountMinor: totals.discountMinor,
          taxMinor: totals.taxMinor,
          taxRateBp: settings.taxRateBp,
          totalMinor: totals.totalMinor,
          shippingAddress: address.data,
          billingAddress,
          notes: address.data.notes || null,
          placedAt: new Date(),
        })
        .returning({ id: orders.id });

      if (!order) throw new CheckoutError("Could not create the order.");

      await tx.insert(orderItems).values(
        lines.map((line, index) => ({
          orderId: order.id,
          variantId: line.variantId,
          sku: line.sku,
          title: line.title,
          unitPriceMinor: line.unitPriceMinor,
          quantity: line.quantity,
          lineTotalMinor: line.unitPriceMinor * line.quantity,
          position: index,
        })),
      );

      for (const item of items) {
        await tx
          .update(variants)
          .set({
            stockQty: sql`${variants.stockQty} - ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(variants.id, item.variantId));
      }

      // The cart is consumed. A new one is created on the next add-to-cart.
      await tx.delete(cartItems).where(eq(cartItems.cartId, cartId));
      await tx.update(carts).set({ expiresAt: new Date(0) }).where(eq(carts.id, cartId));

      return {
        orderId: order.id,
        number,
        subtotalMinor: totals.subtotalMinor,
        shippingMinor: totals.shippingMinor,
        discountMinor: totals.discountMinor,
        taxMinor: totals.taxMinor,
        totalMinor: totals.totalMinor,
        lines,
      };
    });
  } catch (error) {
    if (error instanceof CheckoutError) return fail(error.userMessage);
    throw error;
  }

  const payment = await paymentProvider.charge({
    orderId: committed.orderId,
    orderNumber: committed.number,
    amountMinor: committed.totalMinor,
    currency: "AED",
    email: email.data,
  });

  await db
    .update(orders)
    .set({
      paymentStatus: payment.status,
      status: payment.status === "paid" ? "confirmed" : "pending",
      updatedAt: new Date(),
    })
    .where(eq(orders.id, committed.orderId));

  const orderUrl = `${process.env.NEXT_PUBLIC_STORE_URL ?? "http://localhost:3000"}/orders/${committed.number}?t=${lookup.token}`;

  await mailer
    .send({
      to: email.data,
      subject: `Order ${committed.number} confirmed`,
      text: [
        `Thanks for your order.`,
        ``,
        ...committed.lines.map(
          (line) => `${line.quantity} × ${line.title} — ${(line.unitPriceMinor * line.quantity) / 100} AED`,
        ),
        ``,
        `Total: ${committed.totalMinor / 100} AED (including ${committed.taxMinor / 100} AED VAT)`,
        ``,
        `View or track your order: ${orderUrl}`,
        ``,
        `Keep that link — it is the only way back into the order without an account.`,
      ].join("\n"),
    })
    .catch((error) => {
      // Mail failing must not fail an order that has already been placed.
      console.error("order confirmation mail failed", error);
    });

  return ok({
    number: committed.number,
    lookupToken: lookup.token,
    totalMinor: committed.totalMinor,
    paymentStatus: payment.status,
  });
}

function toOrderView(
  order: typeof orders.$inferSelect,
  items: (typeof orderItems.$inferSelect)[],
): OrderView {
  return {
    number: order.number,
    email: order.email,
    status: order.status,
    paymentStatus: order.paymentStatus,
    placedAt: order.placedAt,
    subtotalMinor: order.subtotalMinor,
    shippingMinor: order.shippingMinor,
    discountMinor: order.discountMinor,
    taxMinor: order.taxMinor,
    totalMinor: order.totalMinor,
    currency: order.currency,
    userId: order.userId,
    shippingAddress: addressSchema.parse(order.shippingAddress),
    billingAddress: order.billingAddress ? addressSchema.parse(order.billingAddress) : null,
    notes: order.notes,
    items: items.map((item) => ({
      sku: item.sku,
      title: item.title,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
      lineTotalMinor: item.lineTotalMinor,
    })),
  };
}

async function loadOrderView(order: typeof orders.$inferSelect): Promise<OrderView> {
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))
    .orderBy(asc(orderItems.position));

  return toOrderView(order, items);
}

export async function getOrderForGuest(
  number: string,
  token: string,
): Promise<OrderView | null> {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.number, number), eq(orders.lookupTokenHash, hashLookupToken(token))))
    .limit(1);

  if (!order) return null;
  if (order.lookupExpiresAt.getTime() < Date.now()) return null;

  return loadOrderView(order);
}

export async function getOrderForCustomer(
  number: string,
  userId: string,
): Promise<OrderView | null> {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.number, number), eq(orders.userId, userId)))
    .limit(1);

  if (!order) return null;

  return loadOrderView(order);
}

export async function listOrdersForCustomer(userId: string): Promise<CustomerOrderSummary[]> {
  return db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      placedAt: orders.placedAt,
      totalMinor: orders.totalMinor,
      itemCount: sql<number>`(
        select count(*) from ${orderItems}
        where ${orderItems.orderId} = ${orders.id}
      )::int`,
    })
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.placedAt));
}

export async function getCustomerOrderStats(userId: string) {
  const [row] = await db
    .select({
      orderCount: sql<number>`count(*)::int`,
      totalSpentMinor: sql<number>`coalesce(sum(${orders.totalMinor}), 0)::int`,
      lastOrderAt: sql<Date | string | null>`max(${orders.placedAt})`,
    })
    .from(orders)
    .where(and(eq(orders.userId, userId), ne(orders.status, "cancelled")));

  return row ?? { orderCount: 0, totalSpentMinor: 0, lastOrderAt: null };
}

/**
 * Attaches a guest order to a signed-in customer. The lookup token is the
 * proof of ownership: knowing an order number alone must never expose it.
 */
export async function claimOrder(input: {
  number: string;
  token: string;
  userId: string;
  ip?: string | null;
}): Promise<Result<{ number: string }>> {
  const [order] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.number, input.number),
        eq(orders.lookupTokenHash, hashLookupToken(input.token)),
      ),
    )
    .limit(1);

  if (!order) return fail("That order number and token do not match.");
  if (order.lookupExpiresAt.getTime() < Date.now()) {
    return fail("That order link has expired.");
  }
  if (order.userId === input.userId) return ok({ number: order.number });
  if (order.userId) return fail("That order is already linked to another account.");

  const claimed = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(orders)
      .set({ userId: input.userId, updatedAt: new Date() })
      .where(and(eq(orders.id, order.id), isNull(orders.userId)))
      .returning({ id: orders.id });

    if (!updated) return false;

    await tx.insert(auditLog).values({
      actorUserId: input.userId,
      action: "order.claim",
      entity: "orders",
      entityId: order.id,
      before: { userId: null },
      after: { userId: input.userId },
      ip: input.ip ?? null,
    });

    return true;
  });

  if (!claimed) return fail("That order is already linked to another account.");

  return ok({ number: order.number });
}

export async function listRecentOrdersForAdmin(limit = 50) {
  return db.select().from(orders).orderBy(sql`${orders.placedAt} desc`).limit(limit);
}
