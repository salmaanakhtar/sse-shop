import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { addressSchema, type Address } from "@/lib/address";
import { priceCart } from "@/lib/pricing";
import { fail, ok, type Result } from "@/lib/result";
import { effectivePriceMinor } from "@/lib/sale";
import { db } from "../db/client";
import {
  auditLog,
  cartItems,
  carts,
  counters,
  orderEvents,
  orderItems,
  orders,
  products,
  refunds,
  variants,
} from "../db/schema";
import { mailer } from "../mail";
import { paymentProvider } from "../payments";
import { readCartIdForCheckout } from "./cart";
import { getStoreSettings } from "./settings";
import { resolveShippingRate } from "./shipping";

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
  id: string;
  number: string;
  email: string;
  status: string;
  paymentStatus: string;
  paymentReference: string | null;
  placedAt: Date;
  subtotalMinor: number;
  shippingMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  refundedMinor: number;
  currency: string;
  userId: string | null;
  trackingCarrier: string | null;
  trackingNumber: string | null;
  invoiceNumber: string | null;
  fulfilledAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancellationRequestedAt: Date | null;
  cancellationReason: string | null;
  returnRequestedAt: Date | null;
  returnReceivedAt: Date | null;
  returnReason: string | null;
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
    lines: {
      variantId: string;
      sku: string;
      title: string;
      unitPriceMinor: number;
      quantity: number;
      weightGrams: number;
    }[];
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
          salePriceMinor: variants.salePriceMinor,
          saleStartsAt: variants.saleStartsAt,
          saleEndsAt: variants.saleEndsAt,
          stockQty: variants.stockQty,
          weightGrams: variants.weightGrams,
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
      const now = new Date();

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
          unitPriceMinor: effectivePriceMinor(variant.priceMinor, variant, now),
          quantity: item.quantity,
          weightGrams: variant.weightGrams ?? 0,
        });
      }

      const subtotalMinor = lines.reduce(
        (sum, line) => sum + line.unitPriceMinor * line.quantity,
        0,
      );
      const weightGrams = lines.reduce(
        (sum, line) => sum + line.weightGrams * line.quantity,
        0,
      );
      const delivery = await resolveShippingRate(
        address.data.emirate,
        subtotalMinor,
        weightGrams,
      );

      const totals = priceCart({
        lines: lines.map((line) => ({
          unitPriceMinor: line.unitPriceMinor,
          quantity: line.quantity,
        })),
        shippingMinor: delivery.rateMinor,
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
      paymentReference: payment.reference,
      status: payment.status === "paid" ? "confirmed" : "pending",
      updatedAt: new Date(),
    })
    .where(eq(orders.id, committed.orderId));

  const orderUrl = `${process.env.NEXT_PUBLIC_STORE_URL ?? "http://localhost:3000"}/orders/${committed.number}?t=${lookup.token}`;

  if (payment.status === "paid") {
    await mailer
      .send({
        to: email.data,
        subject: `Order ${committed.number} confirmed`,
        text: [
          `Thanks for your order.`,
          ``,
          ...committed.lines.map(
            (line) =>
              `${line.quantity} × ${line.title} — ${(line.unitPriceMinor * line.quantity) / 100} AED`,
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
  }

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
    id: order.id,
    number: order.number,
    email: order.email,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentReference: order.paymentReference,
    placedAt: order.placedAt,
    subtotalMinor: order.subtotalMinor,
    shippingMinor: order.shippingMinor,
    discountMinor: order.discountMinor,
    taxMinor: order.taxMinor,
    totalMinor: order.totalMinor,
    refundedMinor: order.refundedMinor,
    currency: order.currency,
    userId: order.userId,
    trackingCarrier: order.trackingCarrier,
    trackingNumber: order.trackingNumber,
    invoiceNumber: order.invoiceNumber,
    fulfilledAt: order.fulfilledAt,
    deliveredAt: order.deliveredAt,
    cancelledAt: order.cancelledAt,
    cancellationRequestedAt: order.cancellationRequestedAt,
    cancellationReason: order.cancellationReason,
    returnRequestedAt: order.returnRequestedAt,
    returnReceivedAt: order.returnReceivedAt,
    returnReason: order.returnReason,
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

export type AdminOrderDetail = OrderView & {
  adminNotes: string | null;
  events: (typeof orderEvents.$inferSelect)[];
  refunds: (typeof refunds.$inferSelect)[];
};

export async function getOrderForAdmin(id: string): Promise<AdminOrderDetail | null> {
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return null;

  const [items, events, refundRows] = await Promise.all([
    db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, id))
      .orderBy(asc(orderItems.position)),
    db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, id))
      .orderBy(desc(orderEvents.createdAt)),
    db
      .select()
      .from(refunds)
      .where(eq(refunds.orderId, id))
      .orderBy(desc(refunds.createdAt)),
  ]);

  return {
    ...toOrderView(order, items),
    adminNotes: order.adminNotes,
    events,
    refunds: refundRows,
  };
}

export async function getOrderForAdminByNumber(
  number: string,
): Promise<AdminOrderDetail | null> {
  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.number, number))
    .limit(1);
  return order ? getOrderForAdmin(order.id) : null;
}

type OrderTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function addOrderEvent(
  tx: OrderTx,
  orderId: string,
  type: string,
  message: string,
  actorUserId: string | null,
): Promise<void> {
  await tx.insert(orderEvents).values({ orderId, type, message, actorUserId });
}

async function restockOrder(tx: OrderTx, orderId: string): Promise<void> {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const item of items) {
    if (!item.variantId) continue;
    await tx
      .update(variants)
      .set({
        stockQty: sql`${variants.stockQty} + ${item.quantity}`,
        updatedAt: new Date(),
      })
      .where(eq(variants.id, item.variantId));
  }
}

async function sendShippingEmail(order: typeof orders.$inferSelect): Promise<void> {
  if (!order.trackingNumber) return;
  await mailer
    .send({
      to: order.email,
      subject: `Order ${order.number} is on its way`,
      text: [
        `Your order is on its way.`,
        ``,
        `Carrier: ${order.trackingCarrier || "Store delivery"}`,
        `Tracking: ${order.trackingNumber}`,
        ``,
        `Order number: ${order.number}`,
      ].join("\n"),
    })
    .catch((error) => {
      console.error("shipping mail failed", error);
    });
}

export async function markOrderProcessing(
  id: string,
  actorUserId: string,
): Promise<Result<{ status: string }>> {
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return fail("That order could not be found.");
  if (!["pending", "confirmed"].includes(order.status)) {
    return fail("Only a pending or confirmed order can move to processing.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(orders.id, id));
    await addOrderEvent(tx, id, "processing", "Order is being prepared.", actorUserId);
  });

  return ok({ status: "processing" });
}

export async function markOrderShipped(
  id: string,
  input: { carrier: string; trackingNumber: string },
  actorUserId: string,
): Promise<Result<{ status: string }>> {
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return fail("That order could not be found.");
  if (!["processing", "confirmed"].includes(order.status)) {
    return fail("Only a confirmed or processing order can be shipped.");
  }
  if (!input.trackingNumber.trim()) return fail("Enter a tracking number.");

  const [updated] = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(orders)
      .set({
        status: "shipped",
        trackingCarrier: input.carrier.trim(),
        trackingNumber: input.trackingNumber.trim(),
        fulfilledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id))
      .returning();
    if (row) {
      await addOrderEvent(
        tx,
        id,
        "shipped",
        `${input.carrier || "Carrier"} · ${input.trackingNumber}`,
        actorUserId,
      );
    }
    return [row];
  });

  if (!updated) return fail("That order could not be found.");
  await sendShippingEmail(updated);
  return ok({ status: "shipped" });
}

export async function markOrderDelivered(
  id: string,
  actorUserId: string,
): Promise<Result<{ status: string }>> {
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return fail("That order could not be found.");
  if (order.status !== "shipped") return fail("Only a shipped order can be delivered.");

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({ status: "delivered", deliveredAt: new Date(), updatedAt: new Date() })
      .where(eq(orders.id, id));
    await addOrderEvent(tx, id, "delivered", "Order delivered.", actorUserId);
  });

  return ok({ status: "delivered" });
}

export async function cancelOrder(
  id: string,
  actorUserId: string,
): Promise<Result<{ status: string }>> {
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return fail("That order could not be found.");
  if (!["pending", "confirmed", "processing"].includes(order.status)) {
    return fail("This order can no longer be cancelled. Use the return flow.");
  }

  await db.transaction(async (tx) => {
    await restockOrder(tx, id);
    await tx
      .update(orders)
      .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(orders.id, id));
    await addOrderEvent(tx, id, "cancelled", "Order cancelled and stock restored.", actorUserId);
  });

  return ok({ status: "cancelled" });
}

export async function requestOrderCancellation(input: {
  number: string;
  token?: string | null;
  userId?: string | null;
  reason: string;
}): Promise<Result<{ status: string }>> {
  const order = input.token
    ? await getOrderForGuest(input.number, input.token)
    : input.userId
      ? await getOrderForCustomer(input.number, input.userId)
      : null;

  if (!order) return fail("That order could not be found.");
  if (!["pending", "confirmed", "processing"].includes(order.status)) {
    return fail("This order is already fulfilled or closed. Use the return flow instead.");
  }
  if (order.cancellationRequestedAt) {
    return fail("A cancellation has already been requested for this order.");
  }
  if (!input.reason.trim()) return fail("Tell us why you want to cancel the order.");

  const settings = await getStoreSettings();

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        cancellationRequestedAt: new Date(),
        cancellationReason: input.reason.trim(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));
    await addOrderEvent(
      tx,
      order.id,
      "cancellation_requested",
      input.reason.trim(),
      input.userId ?? null,
    );
  });

  await mailer
    .send({
      to: settings.contactEmail,
      subject: `Cancellation requested: ${order.number}`,
      text: `A cancellation was requested for ${order.number}.\n\nReason: ${input.reason.trim()}\n\nCancel and restock it in the admin.`,
    })
    .catch((error) => {
      console.error("cancellation request mail failed", error);
    });

  return ok({ status: "cancellation_requested" });
}

export async function requestOrderReturn(input: {
  number: string;
  token?: string | null;
  userId?: string | null;
  reason: string;
}): Promise<Result<{ status: string }>> {
  const order = input.token
    ? await getOrderForGuest(input.number, input.token)
    : input.userId
      ? await getOrderForCustomer(input.number, input.userId)
      : null;

  if (!order) return fail("That order could not be found.");
  if (order.status !== "delivered") {
    return fail("A return can be requested after the order is delivered.");
  }
  if (order.returnRequestedAt) return fail("A return has already been requested.");
  if (!input.reason.trim()) return fail("Tell us why you want to return the order.");

  const settings = await getStoreSettings();
  const deliveredAt = order.deliveredAt ?? order.fulfilledAt;
  if (!deliveredAt) return fail("Delivery date is not available for this order.");
  const windowDays = settings.returnWindowDays;
  if (windowDays <= 0) return fail("Returns are not available for this store.");
  const deadline = new Date(deliveredAt.getTime() + windowDays * 24 * 60 * 60 * 1000);
  if (Date.now() > deadline.getTime()) {
    return fail(`The ${windowDays}-day return window has passed.`);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        status: "return_requested",
        returnRequestedAt: new Date(),
        returnReason: input.reason.trim(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));
    await addOrderEvent(
      tx,
      order.id,
      "return_requested",
      input.reason.trim(),
      input.userId ?? null,
    );
  });

  await mailer
    .send({
      to: settings.contactEmail,
      subject: `Return requested: ${order.number}`,
      text: `A return was requested for ${order.number}.\n\nReason: ${input.reason.trim()}`,
    })
    .catch((error) => {
      console.error("return request mail failed", error);
    });

  return ok({ status: "return_requested" });
}

export async function approveOrderReturn(
  id: string,
  actorUserId: string,
): Promise<Result<{ status: string }>> {
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return fail("That order could not be found.");
  if (order.status !== "return_requested") {
    return fail("Only a requested return can be approved.");
  }

  await db.transaction(async (tx) => {
    await restockOrder(tx, id);
    await tx
      .update(orders)
      .set({ status: "returned", returnReceivedAt: new Date(), updatedAt: new Date() })
      .where(eq(orders.id, id));
    await addOrderEvent(tx, id, "returned", "Return received and stock restored.", actorUserId);
  });

  return ok({ status: "returned" });
}

export async function refundOrder(
  id: string,
  amountMinor: number,
  reason: string,
  actorUserId: string,
): Promise<Result<{ refundedMinor: number }>> {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    return fail("Enter a refund amount greater than zero.");
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return fail("That order could not be found.");
  if (order.refundedMinor + amountMinor > order.totalMinor) {
    return fail("The refund cannot exceed the order total.");
  }

  const newRefunded = order.refundedMinor + amountMinor;

  await db.transaction(async (tx) => {
    await tx.insert(refunds).values({
      orderId: id,
      amountMinor,
      reason: reason.trim(),
      actorUserId,
    });
    await tx
      .update(orders)
      .set({
        refundedMinor: newRefunded,
        paymentStatus: newRefunded >= order.totalMinor ? "refunded" : "paid",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id));
    await addOrderEvent(
      tx,
      id,
      "refund",
      `${(amountMinor / 100).toFixed(2)} AED refunded${reason.trim() ? ` · ${reason.trim()}` : ""}`,
      actorUserId,
    );
  });

  return ok({ refundedMinor: newRefunded });
}

export async function ensureInvoice(
  id: string,
  actorUserId?: string | null,
): Promise<Result<{ invoiceNumber: string }>> {
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return fail("That order could not be found.");
  if (order.invoiceNumber) return ok({ invoiceNumber: order.invoiceNumber });

  const invoiceNumber = await db.transaction(async (tx) => {
    const year = new Date().getFullYear();
    const counterKey = `invoice_number_${year}`;
    await tx.insert(counters).values({ key: counterKey, value: 0 }).onConflictDoNothing();
    const [row] = await tx
      .update(counters)
      .set({ value: sql`${counters.value} + 1`, updatedAt: new Date() })
      .where(eq(counters.key, counterKey))
      .returning({ value: counters.value });

    const number = `INV-${year}-${String(row?.value ?? 1).padStart(6, "0")}`;
    await tx
      .update(orders)
      .set({ invoiceNumber: number, invoiceIssuedAt: new Date(), updatedAt: new Date() })
      .where(eq(orders.id, id));
    await addOrderEvent(tx, id, "invoice", `Invoice ${number} issued.`, actorUserId ?? null);
    return number;
  });

  return ok({ invoiceNumber });
}
