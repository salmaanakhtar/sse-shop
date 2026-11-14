import {
  requestCancellationAction,
  requestReturnAction,
} from "@/app/(storefront)/return-actions";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/field";
import { formatMoney } from "@/lib/money";
import type { OrderView } from "@/server/services/orders";

function withinWindow(order: OrderView, returnWindowDays: number): boolean {
  const delivered = order.deliveredAt ?? order.fulfilledAt;
  if (!delivered || returnWindowDays <= 0) return false;
  const deadline = delivered.getTime() + returnWindowDays * 24 * 60 * 60 * 1000;
  return Date.now() <= deadline;
}

export function OrderAftercare({
  order,
  token,
  returnWindowDays,
  returnError,
  cancelError,
  cancellationRequested,
  returnRequested,
}: {
  order: OrderView;
  token?: string;
  returnWindowDays: number;
  returnError?: string;
  cancelError?: string;
  cancellationRequested?: boolean;
  returnRequested?: boolean;
}) {
  const tokenQuery = token ? `?t=${encodeURIComponent(token)}` : "";
  const canCancel = ["pending", "confirmed", "processing"].includes(order.status);
  const canRequestReturn =
    order.status === "delivered" &&
    !order.returnRequestedAt &&
    withinWindow(order, returnWindowDays);

  return (
    <div className="mt-6 space-y-4">
      {returnRequested ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Your return request was sent. We will reply by email.
        </p>
      ) : null}
      {cancellationRequested ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Your cancellation request was sent. We will confirm it by email.
        </p>
      ) : null}
      {returnError ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {returnError}
        </p>
      ) : null}
      {cancelError ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {cancelError}
        </p>
      ) : null}

      {order.status === "cancelled" ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">Order cancelled</h2>
          <p className="mt-2 text-sm text-muted">
            This order was cancelled
            {order.cancelledAt ? ` on ${order.cancelledAt.toLocaleDateString("en-AE")}` : ""}. Any
            payment taken is refunded to the original method.
          </p>
        </section>
      ) : null}

      {order.trackingNumber ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">Tracking</h2>
          <p className="mt-2 text-sm text-muted">
            {order.trackingCarrier || "Store delivery"} ·{" "}
            <span className="font-medium text-ink">{order.trackingNumber}</span>
          </p>
          {order.deliveredAt ? (
            <p className="mt-1 text-xs text-muted">
              Delivered {order.deliveredAt.toLocaleDateString("en-AE")}
            </p>
          ) : null}
        </section>
      ) : null}

      {order.refundedMinor > 0 ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">Refund</h2>
          <p className="mt-2 text-sm text-muted">
            {formatMoney(order.refundedMinor)} has been recorded as refunded. Bank processing times
            depend on your provider.
          </p>
        </section>
      ) : null}

      {order.invoiceNumber ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">Tax invoice</h2>
          <p className="mt-2 text-sm text-muted">{order.invoiceNumber}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`/orders/${encodeURIComponent(order.number)}/invoice${tokenQuery}`}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:bg-page"
            >
              View invoice
            </a>
            <a
              href={`/orders/${encodeURIComponent(order.number)}/invoice/pdf${tokenQuery}`}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:bg-page"
            >
              Download PDF
            </a>
          </div>
        </section>
      ) : null}

      {canCancel ? (
        order.cancellationRequestedAt ? (
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold">Cancellation requested</h2>
            <p className="mt-2 text-sm text-muted">
              We received your cancellation request and will confirm it by email.
            </p>
            {order.cancellationReason ? (
              <p className="mt-2 text-xs text-muted">Reason: {order.cancellationReason}</p>
            ) : null}
          </section>
        ) : (
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold">Need to cancel?</h2>
            <p className="mt-2 text-sm text-muted">
              Orders can be cancelled until they are shipped. Send a request and the store will
              cancel it and restore stock.
            </p>
            <form action={requestCancellationAction} className="mt-4 space-y-3">
              <input type="hidden" name="number" value={order.number} />
              {token ? <input type="hidden" name="token" value={token} /> : null}
              <div>
                <Label htmlFor={`cancel-reason-${order.number}`}>Reason</Label>
                <Textarea
                  id={`cancel-reason-${order.number}`}
                  name="reason"
                  rows={2}
                  required
                  minLength={4}
                  maxLength={500}
                />
              </div>
              <Button type="submit" size="sm" variant="secondary">
                Request cancellation
              </Button>
            </form>
          </section>
        )
      ) : null}

      {order.status === "return_requested" ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">Return requested</h2>
          <p className="mt-2 text-sm text-muted">
            We received your request and will confirm the return steps by email.
          </p>
          {order.returnReason ? (
            <p className="mt-2 text-xs text-muted">Reason: {order.returnReason}</p>
          ) : null}
        </section>
      ) : null}

      {order.status === "returned" ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">Return received</h2>
          <p className="mt-2 text-sm text-muted">
            The returned items have been received and the refund is being processed.
          </p>
        </section>
      ) : null}

      {canRequestReturn ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">Request a return</h2>
          <p className="mt-2 text-sm text-muted">
            Returns are accepted within {returnWindowDays} days of delivery, provided the items are
            unused and in their original condition. Tell us what went wrong and we will reply by
            email.
          </p>
          <form action={requestReturnAction} className="mt-4 space-y-3">
            <input type="hidden" name="number" value={order.number} />
            {token ? <input type="hidden" name="token" value={token} /> : null}
            <div>
              <Label htmlFor={`return-reason-${order.number}`}>Reason</Label>
              <Textarea
                id={`return-reason-${order.number}`}
                name="reason"
                rows={3}
                required
                minLength={4}
                maxLength={1_000}
              />
            </div>
            <Button type="submit" size="sm" variant="secondary">
              Submit return request
            </Button>
          </form>
        </section>
      ) : null}

      {order.status === "delivered" && !order.returnRequestedAt && !canRequestReturn ? (
        <p className="text-xs text-muted">
          The {returnWindowDays}-day return window for this order has closed. Contact the store if
          you need help with a faulty item.
        </p>
      ) : null}
    </div>
  );
}
