import {
  requestCancellationAction,
  requestReturnAction,
} from "@/app/(storefront)/return-actions";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/field";
import { formatDateFor, translate, type Locale, type NumeralStyle } from "@/lib/i18n";
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
  locale = "en",
  numerals = "latin",
}: {
  order: OrderView;
  token?: string;
  returnWindowDays: number;
  returnError?: string;
  cancelError?: string;
  cancellationRequested?: boolean;
  returnRequested?: boolean;
  locale?: Locale;
  numerals?: NumeralStyle;
}) {
  const money = (minor: number) => formatMoney(minor, { locale, numerals });
  const date = (value: Date) => formatDateFor(value, locale, numerals);
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
          {translate(locale, "order.returnSent")}
        </p>
      ) : null}
      {cancellationRequested ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {translate(locale, "order.cancelSent")}
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
          <h2 className="text-sm font-semibold">{translate(locale, "order.cancelled")}</h2>
          <p className="mt-2 text-sm text-muted">
            {translate(locale, "order.cancelledBody", {
              cancelledOn: order.cancelledAt
                ? translate(locale, "order.cancelledOn", { date: date(order.cancelledAt) })
                : "",
            })}
          </p>
        </section>
      ) : null}

      {order.trackingNumber ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">{translate(locale, "order.tracking")}</h2>
          <p className="mt-2 text-sm text-muted">
            {order.trackingCarrier || translate(locale, "order.delivery")} ·{" "}
            <span className="font-medium text-ink">{order.trackingNumber}</span>
          </p>
          {order.deliveredAt ? (
            <p className="mt-1 text-xs text-muted">
              {translate(locale, "order.deliveredOn", { date: date(order.deliveredAt) })}
            </p>
          ) : null}
        </section>
      ) : null}

      {order.refundedMinor > 0 ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">{translate(locale, "order.refund")}</h2>
          <p className="mt-2 text-sm text-muted">
            {translate(locale, "order.refundBody", { amount: money(order.refundedMinor) })}
          </p>
        </section>
      ) : null}

      {order.invoiceNumber ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">{translate(locale, "order.taxInvoice")}</h2>
          <p className="mt-2 text-sm text-muted">{order.invoiceNumber}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`/orders/${encodeURIComponent(order.number)}/invoice${tokenQuery}`}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:bg-page"
            >
              {translate(locale, "order.viewInvoice")}
            </a>
            <a
              href={`/orders/${encodeURIComponent(order.number)}/invoice/pdf${tokenQuery}`}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:bg-page"
            >
              {translate(locale, "order.downloadPdf")}
            </a>
          </div>
        </section>
      ) : null}

      {canCancel ? (
        order.cancellationRequestedAt ? (
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold">{translate(locale, "order.cancelRequested")}</h2>
            <p className="mt-2 text-sm text-muted">
              {translate(locale, "order.cancelRequestedBody")}
            </p>
            {order.cancellationReason ? (
              <p className="mt-2 text-xs text-muted">
                {translate(locale, "order.reasonPrefix", { reason: order.cancellationReason })}
              </p>
            ) : null}
          </section>
        ) : (
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold">{translate(locale, "order.cancelTitle")}</h2>
            <p className="mt-2 text-sm text-muted">{translate(locale, "order.cancelBody")}</p>
            <form action={requestCancellationAction} className="mt-4 space-y-3">
              <input type="hidden" name="number" value={order.number} />
              {token ? <input type="hidden" name="token" value={token} /> : null}
              <div>
                <Label htmlFor={`cancel-reason-${order.number}`}>
                  {translate(locale, "order.cancelLabel")}
                </Label>
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
                {translate(locale, "order.requestCancel")}
              </Button>
            </form>
          </section>
        )
      ) : null}

      {order.status === "return_requested" ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">{translate(locale, "order.returnRequested")}</h2>
          <p className="mt-2 text-sm text-muted">{translate(locale, "order.returnRequestedBody")}</p>
          {order.returnReason ? (
            <p className="mt-2 text-xs text-muted">
              {translate(locale, "order.reasonPrefix", { reason: order.returnReason })}
            </p>
          ) : null}
        </section>
      ) : null}

      {order.status === "returned" ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">{translate(locale, "order.returnReceived")}</h2>
          <p className="mt-2 text-sm text-muted">{translate(locale, "order.returnReceivedBody")}</p>
        </section>
      ) : null}

      {canRequestReturn ? (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">{translate(locale, "order.requestReturn")}</h2>
          <p className="mt-2 text-sm text-muted">
            {translate(locale, "order.returnBody", { days: returnWindowDays })}
          </p>
          <form action={requestReturnAction} className="mt-4 space-y-3">
            <input type="hidden" name="number" value={order.number} />
            {token ? <input type="hidden" name="token" value={token} /> : null}
            <div>
              <Label htmlFor={`return-reason-${order.number}`}>
                {translate(locale, "order.returnLabel")}
              </Label>
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
              {translate(locale, "order.submitReturn")}
            </Button>
          </form>
        </section>
      ) : null}

      {order.status === "delivered" && !order.returnRequestedAt && !canRequestReturn ? (
        <p className="text-xs text-muted">
          {translate(locale, "order.returnClosed", { days: returnWindowDays })}
        </p>
      ) : null}
    </div>
  );
}
