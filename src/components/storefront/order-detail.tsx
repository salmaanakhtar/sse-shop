import type { ReactNode } from "react";
import { formatAddress } from "@/lib/address";
import { formatMoney } from "@/lib/money";
import type { OrderView } from "@/server/services/orders";

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting payment",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  fulfilled: "On its way",
  cancelled: "Cancelled",
  return_requested: "Return requested",
  returned: "Returned",
};

function sameAddress(a: OrderView["shippingAddress"], b: OrderView["shippingAddress"]): boolean {
  return (
    a.fullName === b.fullName &&
    a.phone === b.phone &&
    a.emirate === b.emirate &&
    a.street === b.street &&
    a.building === b.building &&
    a.area === b.area &&
    a.poBox === b.poBox
  );
}

export function OrderDetail({ order, children }: { order: OrderView; children?: ReactNode }) {
  const billingMatchesDelivery =
    order.billingAddress !== null && sameAddress(order.shippingAddress, order.billingAddress);

  return (
    <>
      <div className="mt-8 rounded-xl border border-line bg-surface">
        <ul className="divide-y divide-line">
          {order.items.map((item, index) => (
            <li
              key={`${index}-${item.sku}-${item.title}`}
              className="flex justify-between gap-4 px-5 py-4"
            >
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {item.sku} · × {item.quantity}
                </p>
              </div>
              <p className="shrink-0 text-sm tabular-nums">{formatMoney(item.lineTotalMinor)}</p>
            </li>
          ))}
        </ul>

        <dl className="space-y-2 border-t border-line px-5 py-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="tabular-nums">{formatMoney(order.subtotalMinor)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Delivery</dt>
            <dd className="tabular-nums">
              {order.shippingMinor === 0 ? "Free" : formatMoney(order.shippingMinor)}
            </dd>
          </div>
          {order.discountMinor > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted">Discount</dt>
              <dd className="tabular-nums">−{formatMoney(order.discountMinor)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-line pt-3 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(order.totalMinor)}</dd>
          </div>
          <p className="text-xs text-muted">Includes {formatMoney(order.taxMinor)} VAT</p>
        </dl>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">Delivering to</h2>
          <div className="mt-2 space-y-0.5 text-sm text-muted">
            {formatAddress(order.shippingAddress).map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          {order.notes ? <p className="mt-3 text-xs text-muted">Notes: {order.notes}</p> : null}
          {billingMatchesDelivery ? (
            <p className="mt-3 text-xs text-muted">Billing uses the same address.</p>
          ) : null}
        </section>

        {order.billingAddress && !billingMatchesDelivery ? (
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold">Billing address</h2>
            <div className="mt-2 space-y-0.5 text-sm text-muted">
              {formatAddress(order.billingAddress).map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {children}
    </>
  );
}
