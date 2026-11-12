import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { formatAddress } from "@/lib/address";
import { formatMoney } from "@/lib/money";
import { getOrderForGuest } from "@/server/services/orders";

const STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting payment",
  confirmed: "Confirmed",
  fulfilled: "On its way",
  cancelled: "Cancelled",
};

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const [{ number }, { t }] = await Promise.all([params, searchParams]);

  if (!t) notFound();

  const order = await getOrderForGuest(number, t);
  if (!order) notFound();

  const address = formatAddress(order.shippingAddress);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
        Order confirmed
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{order.number}</h1>
      <p className="mt-2 text-sm text-muted">
        {STATUS_LABEL[order.status] ?? order.status} · placed{" "}
        {order.placedAt.toLocaleDateString("en-AE", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>

      <div className="mt-8 rounded-xl border border-line bg-surface">
        <ul className="divide-y divide-line">
          {order.items.map((item) => (
            <li key={`${item.sku}-${item.title}`} className="flex justify-between gap-4 px-5 py-4">
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
            {address.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          {order.notes ? (
            <p className="mt-3 text-xs text-muted">Notes: {order.notes}</p>
          ) : null}
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">Keep this link</h2>
          <p className="mt-2 text-sm text-muted">
            Without an account, this page is your way back into the order. It was also sent to{" "}
            {order.email}.
          </p>
        </section>
      </div>

      <Link href="/" className={buttonClass("secondary", "md", "mt-8")}>
        Continue shopping
      </Link>
    </div>
  );
}
