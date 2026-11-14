"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseMoney } from "@/lib/money";
import { requireAdminAction } from "../auth/guard";
import { db } from "../db/client";
import { auditLog, orders } from "../db/schema";
import {
  approveOrderReturn,
  cancelOrder,
  ensureInvoice,
  markOrderDelivered,
  markOrderProcessing,
  markOrderShipped,
  refundOrder,
} from "../services/orders";

function backToOrder(id: string, error?: string): never {
  redirect(`/admin/orders/${id}${error ? `?error=${encodeURIComponent(error)}` : "?saved=1"}`);
}

async function audit(
  actorUserId: string,
  action: string,
  orderId: string,
  before: unknown,
  after: unknown,
) {
  await db.insert(auditLog).values({
    actorUserId,
    action,
    entity: "orders",
    entityId: orderId,
    before,
    after,
  });
}

export async function markProcessingAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/admin/orders");

  const [before] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!before) backToOrder(id, "That order could not be found.");

  const result = await markOrderProcessing(id, session.user.id);
  if (!result.ok) backToOrder(id, result.error);

  await audit(session.user.id, "order.processing", id, { status: before.status }, result.data);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  backToOrder(id);
}

export async function markShippedAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/admin/orders");

  const carrier = String(formData.get("carrier") ?? "").trim();
  const trackingNumber = String(formData.get("trackingNumber") ?? "").trim();
  if (!trackingNumber) backToOrder(id, "Enter a tracking number.");

  const [before] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!before) backToOrder(id, "That order could not be found.");

  const result = await markOrderShipped(id, { carrier, trackingNumber }, session.user.id);
  if (!result.ok) backToOrder(id, result.error);

  await audit(
    session.user.id,
    "order.shipped",
    id,
    { status: before.status },
    { status: "shipped", carrier, trackingNumber },
  );
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  backToOrder(id);
}

export async function markDeliveredAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/admin/orders");

  const [before] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!before) backToOrder(id, "That order could not be found.");

  const result = await markOrderDelivered(id, session.user.id);
  if (!result.ok) backToOrder(id, result.error);

  await audit(session.user.id, "order.delivered", id, { status: before.status }, result.data);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  backToOrder(id);
}

export async function cancelOrderAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/admin/orders");

  const [before] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!before) backToOrder(id, "That order could not be found.");

  const result = await cancelOrder(id, session.user.id);
  if (!result.ok) backToOrder(id, result.error);

  await audit(session.user.id, "order.cancelled", id, { status: before.status }, result.data);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  backToOrder(id);
}

export async function approveReturnAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/admin/orders");

  const [before] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!before) backToOrder(id, "That order could not be found.");

  const result = await approveOrderReturn(id, session.user.id);
  if (!result.ok) backToOrder(id, result.error);

  await audit(session.user.id, "order.returned", id, { status: before.status }, result.data);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  backToOrder(id);
}

export async function refundOrderAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/admin/orders");

  const amountMinor = parseMoney(String(formData.get("amount") ?? ""));
  if (amountMinor === null || amountMinor <= 0) {
    backToOrder(id, "Enter a valid refund amount.");
  }

  const reason = String(formData.get("reason") ?? "").trim();
  const [before] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!before) backToOrder(id, "That order could not be found.");

  const result = await refundOrder(id, amountMinor, reason, session.user.id);
  if (!result.ok) backToOrder(id, result.error);

  await audit(
    session.user.id,
    "order.refund",
    id,
    { refundedMinor: before.refundedMinor, paymentStatus: before.paymentStatus },
    result.data,
  );
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  backToOrder(id);
}

export async function issueInvoiceAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/admin/orders");

  const [order] = await db
    .select({ number: orders.number, invoiceNumber: orders.invoiceNumber })
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  if (!order) backToOrder(id, "That order could not be found.");

  const result = await ensureInvoice(id, session.user.id);
  if (!result.ok) backToOrder(id, result.error);

  if (!order.invoiceNumber) {
    await audit(
      session.user.id,
      "order.invoice",
      id,
      { invoiceNumber: null },
      { invoiceNumber: result.data.invoiceNumber },
    );
  }

  redirect(`/orders/${encodeURIComponent(order.number)}/invoice`);
}
