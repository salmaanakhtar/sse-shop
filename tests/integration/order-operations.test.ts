import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import {
  orderEvents,
  orders,
  orderItems,
  products,
  refunds,
  users,
  variants,
} from "@/server/db/schema";
import { mailer } from "@/server/mail";
import {
  approveOrderReturn,
  cancelOrder,
  ensureInvoice,
  getOrderForAdmin,
  markOrderDelivered,
  markOrderProcessing,
  markOrderShipped,
  refundOrder,
  requestOrderCancellation,
  requestOrderReturn,
} from "@/server/services/orders";

const suffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const ADDRESS = {
  fullName: "Order Tester",
  phone: "+971501234567",
  emirate: "Dubai",
  building: "1",
  street: "Test Street",
  area: "",
  poBox: "",
  notes: "",
};

async function createCustomer() {
  const [user] = await db
    .insert(users)
    .values({ name: "Order Tester", email: `orders-${suffix()}@example.com` })
    .returning();
  if (!user) throw new Error("could not create the test customer");
  return user;
}

async function createVariant(stockQty: number, priceMinor = 24_000) {
  const [product] = await db
    .insert(products)
    .values({
      slug: `orders-${suffix()}`,
      title: "Order Product",
      status: "active",
      publishedAt: new Date(),
    })
    .returning();
  if (!product) throw new Error("could not create the test product");

  const [variant] = await db
    .insert(variants)
    .values({
      productId: product.id,
      sku: `ORDERS-${suffix()}`,
      title: "Default",
      priceMinor,
      stockQty,
    })
    .returning();
  if (!variant) throw new Error("could not create the test variant");

  return { product, variant };
}

async function createOrder(input: {
  userId: string;
  variantId: string;
  quantity?: number;
  totalMinor?: number;
  status?: "pending" | "confirmed";
  deliveredAt?: Date | null;
  stockSnapshotTitle?: string;
}) {
  const quantity = input.quantity ?? 1;
  const totalMinor = input.totalMinor ?? 24_000;

  const [order] = await db
    .insert(orders)
    .values({
      number: `SS-2099-${suffix()}`,
      lookupTokenHash: `hash-${suffix()}`,
      lookupExpiresAt: new Date(Date.now() + 86_400_000),
      userId: input.userId,
      email: "order-tester@example.com",
      status: input.status ?? "confirmed",
      paymentStatus: "paid",
      subtotalMinor: totalMinor,
      totalMinor,
      taxMinor: Math.round(totalMinor / 21),
      shippingAddress: ADDRESS,
      deliveredAt: input.deliveredAt ?? null,
    })
    .returning();
  if (!order) throw new Error("could not create the test order");

  await db.insert(orderItems).values({
    orderId: order.id,
    variantId: input.variantId,
    sku: `ORDERS-${suffix()}`,
    title: input.stockSnapshotTitle ?? "Order Product",
    unitPriceMinor: Math.round(totalMinor / quantity),
    quantity,
    lineTotalMinor: totalMinor,
  });

  return order;
}

describe("order operations", () => {
  it("moves an order through processing, shipping, and delivery", async () => {
    const customer = await createCustomer();
    const { variant } = await createVariant(5);
    const order = await createOrder({ userId: customer.id, variantId: variant.id });
    const send = vi.spyOn(mailer, "send").mockResolvedValue(undefined);

    expect((await markOrderProcessing(order.id, customer.id)).ok).toBe(true);
    expect((await markOrderShipped(order.id, { carrier: "Aramex", trackingNumber: "ARX-1" }, customer.id)).ok).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    expect((await markOrderDelivered(order.id, customer.id)).ok).toBe(true);

    const detail = await getOrderForAdmin(order.id);
    expect(detail?.status).toBe("delivered");
    expect(detail?.trackingCarrier).toBe("Aramex");
    expect(detail?.trackingNumber).toBe("ARX-1");
    expect(detail?.deliveredAt).toBeInstanceOf(Date);
    expect(detail?.events.map((event) => event.type).sort()).toEqual([
      "delivered",
      "processing",
      "shipped",
    ]);

    send.mockRestore();
  });

  it("does not cancel an order after it has shipped", async () => {
    const customer = await createCustomer();
    const { variant } = await createVariant(5);
    const order = await createOrder({ userId: customer.id, variantId: variant.id });

    const result = await markOrderShipped(
      order.id,
      { carrier: "Aramex", trackingNumber: "ARX-2" },
      customer.id,
    );
    // A confirmed order can ship directly; a cancelled one cannot.
    expect(result.ok).toBe(true);

    expect((await cancelOrder(order.id, customer.id)).ok).toBe(false);
  });

  it("cancels a pending order and restores stock", async () => {
    const customer = await createCustomer();
    const { variant } = await createVariant(5);
    const order = await createOrder({
      userId: customer.id,
      variantId: variant.id,
      quantity: 3,
      totalMinor: 30_000,
    });

    expect((await cancelOrder(order.id, customer.id)).ok).toBe(true);

    const [after] = await db.select().from(variants).where(eq(variants.id, variant.id));
    expect(after?.stockQty).toBe(8);

    const detail = await getOrderForAdmin(order.id);
    expect(detail?.status).toBe("cancelled");
    expect(detail?.cancelledAt).toBeInstanceOf(Date);
    expect(detail?.events[0]?.type).toBe("cancelled");
  });

  it("records a customer cancellation request without changing status", async () => {
    const customer = await createCustomer();
    const { variant } = await createVariant(5);
    const order = await createOrder({ userId: customer.id, variantId: variant.id });

    const result = await requestOrderCancellation({
      number: order.number,
      userId: customer.id,
      reason: "Ordered the wrong size.",
    });
    expect(result.ok).toBe(true);

    const detail = await getOrderForAdmin(order.id);
    expect(detail?.status).toBe("confirmed");
    expect(detail?.cancellationRequestedAt).toBeInstanceOf(Date);
    expect(detail?.cancellationReason).toBe("Ordered the wrong size.");
    expect(
      await db.select().from(orderEvents).where(eq(orderEvents.orderId, order.id)),
    ).toHaveLength(1);

    expect(
      (
        await requestOrderCancellation({
          number: order.number,
          userId: customer.id,
          reason: "Again.",
        })
      ).ok,
    ).toBe(false);
  });

  it("requests a return inside the window and restocks on approval", async () => {
    const customer = await createCustomer();
    const { variant } = await createVariant(4);
    const order = await createOrder({
      userId: customer.id,
      variantId: variant.id,
      status: "confirmed",
      totalMinor: 24_000,
    });
    await db
      .update(orders)
      .set({
        status: "delivered",
        deliveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      })
      .where(eq(orders.id, order.id));

    const requested = await requestOrderReturn({
      number: order.number,
      userId: customer.id,
      reason: "The colour is different from the photos.",
    });
    expect(requested.ok).toBe(true);

    const [requestedRow] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(requestedRow?.status).toBe("return_requested");
    expect(requestedRow?.returnRequestedAt).toBeInstanceOf(Date);

    expect((await approveOrderReturn(order.id, customer.id)).ok).toBe(true);
    const [returnedRow] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(returnedRow?.status).toBe("returned");
    expect(returnedRow?.returnReceivedAt).toBeInstanceOf(Date);

    const [after] = await db.select().from(variants).where(eq(variants.id, variant.id));
    expect(after?.stockQty).toBe(5);
  });

  it("rejects a return outside the return window", async () => {
    const customer = await createCustomer();
    const { variant } = await createVariant(4);
    const order = await createOrder({
      userId: customer.id,
      variantId: variant.id,
      status: "confirmed",
    });
    await db
      .update(orders)
      .set({
        status: "delivered",
        deliveredAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      })
      .where(eq(orders.id, order.id));

    const result = await requestOrderReturn({
      number: order.number,
      userId: customer.id,
      reason: "Too late.",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("return window");
  });

  it("records partial and full refunds without exceeding the order total", async () => {
    const customer = await createCustomer();
    const { variant } = await createVariant(2);
    const order = await createOrder({
      userId: customer.id,
      variantId: variant.id,
      totalMinor: 24_000,
    });

    expect((await refundOrder(order.id, 10_000, "Goodwill", customer.id)).ok).toBe(true);

    let [row] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(row?.refundedMinor).toBe(10_000);
    expect(row?.paymentStatus).toBe("paid");

    expect((await refundOrder(order.id, 14_000, "Return delivery", customer.id)).ok).toBe(true);

    [row] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(row?.refundedMinor).toBe(24_000);
    expect(row?.paymentStatus).toBe("refunded");

    expect((await refundOrder(order.id, 100, "Too much", customer.id)).ok).toBe(false);
    expect(await db.select().from(refunds).where(eq(refunds.orderId, order.id))).toHaveLength(2);
  });

  it("issues one invoice number per order and increments across orders", async () => {
    const customer = await createCustomer();
    const { variant } = await createVariant(2);
    const first = await createOrder({ userId: customer.id, variantId: variant.id });
    const second = await createOrder({ userId: customer.id, variantId: variant.id });

    const firstIssue = await ensureInvoice(first.id, customer.id);
    expect(firstIssue.ok).toBe(true);
    if (!firstIssue.ok) return;

    const repeated = await ensureInvoice(first.id, customer.id);
    expect(repeated.ok).toBe(true);
    if (!repeated.ok) return;
    expect(repeated.data.invoiceNumber).toBe(firstIssue.data.invoiceNumber);

    const secondIssue = await ensureInvoice(second.id, customer.id);
    expect(secondIssue.ok).toBe(true);
    if (!secondIssue.ok) return;

    expect(firstIssue.data.invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
    expect(secondIssue.data.invoiceNumber).not.toBe(firstIssue.data.invoiceNumber);

    const firstSequence = Number(firstIssue.data.invoiceNumber.slice(-6));
    const secondSequence = Number(secondIssue.data.invoiceNumber.slice(-6));
    expect(secondSequence).toBe(firstSequence + 1);
  });
});
