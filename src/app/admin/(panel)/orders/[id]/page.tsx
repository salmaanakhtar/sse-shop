import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderDetail } from "@/components/storefront/order-detail";
import { Button, buttonClass } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input, Label } from "@/components/ui/field";
import {
  approveReturnAction,
  cancelOrderAction,
  issueInvoiceAction,
  markDeliveredAction,
  markProcessingAction,
  markShippedAction,
  refundOrderAction,
} from "@/server/actions/admin-orders";
import { formatMoney } from "@/lib/money";
import { requireAdminPage } from "@/server/auth/guard";
import { getOrderForAdmin } from "@/server/services/orders";

export const metadata = { title: "Order" };

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  confirmed: "bg-sky-50 text-sky-700",
  processing: "bg-indigo-50 text-indigo-700",
  shipped: "bg-violet-50 text-violet-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-zinc-100 text-zinc-600",
  fulfilled: "bg-emerald-50 text-emerald-700",
  return_requested: "bg-amber-50 text-amber-700",
  returned: "bg-zinc-100 text-zinc-600",
};

export default async function AdminOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireAdminPage();
  const [{ id }, { error, saved }] = await Promise.all([params, searchParams]);
  const order = await getOrderForAdmin(id);
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{order.number}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_STYLE[order.status] ?? ""}`}>
              {order.status.replace("_", " ")}
            </span>
            <span>{order.paymentStatus}</span>
            <span>{order.email}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {order.userId ? (
            <Link href={`/admin/customers/${order.userId}`} className="text-sm text-muted hover:text-ink">
              Customer
            </Link>
          ) : null}
          <Link href="/admin/orders" className="text-sm text-muted hover:text-ink">
            All orders
          </Link>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Order updated.
        </p>
      ) : null}
      {order.cancellationRequestedAt ? (
        <p role="status" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The customer requested cancellation on{" "}
          {order.cancellationRequestedAt.toLocaleDateString("en-AE")}
          {order.cancellationReason ? `: ${order.cancellationReason}` : "."}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {["pending", "confirmed"].includes(order.status) ? (
          <form action={markProcessingAction}>
            <input type="hidden" name="id" value={order.id} />
            <Button type="submit" size="sm" variant="secondary">
              Start processing
            </Button>
          </form>
        ) : null}
        {order.status === "shipped" ? (
          <form action={markDeliveredAction}>
            <input type="hidden" name="id" value={order.id} />
            <Button type="submit" size="sm" variant="secondary">
              Mark delivered
            </Button>
          </form>
        ) : null}
        {order.status === "return_requested" ? (
          <form action={approveReturnAction}>
            <input type="hidden" name="id" value={order.id} />
            <Button type="submit" size="sm" variant="secondary">
              Approve return & restock
            </Button>
          </form>
        ) : null}
        {["pending", "confirmed", "processing"].includes(order.status) ? (
          <form action={cancelOrderAction}>
            <input type="hidden" name="id" value={order.id} />
            <ConfirmSubmitButton
              type="submit"
              message="Cancel this order and restore stock?"
              className={buttonClass("danger", "sm")}
            >
              Cancel & restock
            </ConfirmSubmitButton>
          </form>
        ) : null}
      </div>

      {["confirmed", "processing"].includes(order.status) ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">Ship order</h2>
          <form action={markShippedAction} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={order.id} />
            <div>
              <Label htmlFor="carrier">Carrier</Label>
              <Input id="carrier" name="carrier" placeholder="Aramex, Emirates Post…" />
            </div>
            <div>
              <Label htmlFor="trackingNumber">Tracking number</Label>
              <Input id="trackingNumber" name="trackingNumber" required />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" size="sm">
                Mark shipped & email customer
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {order.trackingNumber ? (
        <section className="rounded-xl border border-line bg-surface p-5 text-sm">
          <h2 className="text-sm font-semibold">Tracking</h2>
          <p className="mt-2 text-muted">
            {order.trackingCarrier || "Store delivery"} · {order.trackingNumber}
          </p>
        </section>
      ) : null}

      <OrderDetail order={order} />

      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Invoice</h2>
            <p className="mt-1 text-xs text-muted">
              {order.invoiceNumber
                ? `${order.invoiceNumber} · refunded ${formatMoney(order.refundedMinor)}`
                : "No invoice issued yet."}
            </p>
          </div>
          {order.invoiceNumber ? (
            <Link
              href={`/orders/${order.number}/invoice`}
              target="_blank"
              className={buttonClass("secondary", "sm")}
            >
              Open invoice / PDF
            </Link>
          ) : (
            <form action={issueInvoiceAction}>
              <input type="hidden" name="id" value={order.id} />
              <Button type="submit" size="sm" variant="secondary">
                Issue invoice
              </Button>
            </form>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">Record refund</h2>
        <form action={refundOrderAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={order.id} />
          <div>
            <Label htmlFor="refund-amount">Amount (AED)</Label>
            <Input id="refund-amount" name="amount" inputMode="decimal" required />
          </div>
          <div>
            <Label htmlFor="refund-reason">Reason</Label>
            <Input id="refund-reason" name="reason" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" variant="secondary">
              Record refund
            </Button>
          </div>
        </form>
      </section>

      {order.adminNotes ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">Admin notes</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-muted">{order.adminNotes}</p>
        </section>
      ) : null}

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">Timeline</h2>
        <ul className="mt-3 space-y-3 text-sm">
          {order.events.length === 0 ? (
            <li className="text-muted">No events yet.</li>
          ) : (
            order.events.map((event) => (
              <li key={event.id} className="border-l-2 border-line pl-3">
                <p className="font-medium capitalize">{event.type.replace("_", " ")}</p>
                <p className="text-xs text-muted">
                  {event.createdAt.toLocaleString("en-AE")} {event.message ? `· ${event.message}` : ""}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
