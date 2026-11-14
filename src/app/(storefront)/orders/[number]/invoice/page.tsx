import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthSession } from "@/server/auth/guard";
import { formatMoney } from "@/lib/money";
import {
  getOrderForAdminByNumber,
  getOrderForCustomer,
  getOrderForGuest,
} from "@/server/services/orders";
import { getStoreSettings } from "@/server/services/settings";

export const metadata = { title: "Invoice" };

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const [{ number }, { t }] = await Promise.all([params, searchParams]);
  const session = await getAuthSession();

  const order = t
    ? await getOrderForGuest(number, t)
    : session?.user.role === "admin"
      ? await getOrderForAdminByNumber(number)
      : session
        ? await getOrderForCustomer(number, session.user.id)
        : null;

  if (!order || !order.invoiceNumber) notFound();

  const settings = await getStoreSettings();
  const pdfQuery = t ? `?t=${encodeURIComponent(t)}` : "";

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/admin/orders" className="text-sm text-muted hover:text-ink">
          Back to orders
        </Link>
        <a
          href={`/orders/${order.number}/invoice/pdf${pdfQuery}`}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:bg-page"
        >
          Download PDF
        </a>
      </div>

      <article className="rounded-xl border border-line bg-surface p-8">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{settings.legalName || settings.name}</h1>
            {settings.address ? <p className="mt-1 whitespace-pre-line text-sm text-muted">{settings.address}</p> : null}
            {settings.contactEmail ? <p className="text-sm text-muted">{settings.contactEmail}</p> : null}
            {settings.trn ? <p className="text-sm text-muted">TRN: {settings.trn}</p> : null}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">Tax invoice</p>
            <p className="mt-1 text-lg font-semibold">{order.invoiceNumber}</p>
            <p className="text-sm text-muted">Order {order.number}</p>
            <p className="text-sm text-muted">{order.placedAt.toLocaleDateString("en-AE")}</p>
          </div>
        </header>

        <section className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Billed to</h2>
            <div className="mt-2 space-y-0.5 text-sm text-muted">
              <p className="text-ink">{order.email}</p>
              <p>{order.shippingAddress.fullName}</p>
              <p>{order.shippingAddress.phone}</p>
            </div>
          </div>
          <div>
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Deliver to</h2>
            <div className="mt-2 space-y-0.5 text-sm text-muted">
              <p>{order.shippingAddress.building}</p>
              <p>{order.shippingAddress.street}</p>
              <p>
                {order.shippingAddress.area ? `${order.shippingAddress.area}, ` : ""}
                {order.shippingAddress.emirate}
              </p>
            </div>
          </div>
        </section>

        <table className="mt-8 w-full text-sm">
          <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="py-2 font-semibold">Item</th>
              <th className="py-2 text-right font-semibold">Qty</th>
              <th className="py-2 text-right font-semibold">Unit</th>
              <th className="py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {order.items.map((item) => (
              <tr key={`${item.sku}-${item.title}`}>
                <td className="py-2">
                  <span className="block">{item.title}</span>
                  <span className="text-xs text-muted">{item.sku}</span>
                </td>
                <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(item.unitPriceMinor)}</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(item.lineTotalMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto mt-6 max-w-xs space-y-2 text-sm">
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
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(order.totalMinor)}</dd>
          </div>
          <div className="flex justify-between text-xs text-muted">
            <dt>VAT included</dt>
            <dd className="tabular-nums">{formatMoney(order.taxMinor)}</dd>
          </div>
          {order.refundedMinor > 0 ? (
            <div className="flex justify-between text-xs text-red-600">
              <dt>Refunded</dt>
              <dd className="tabular-nums">{formatMoney(order.refundedMinor)}</dd>
            </div>
          ) : null}
        </dl>

        <p className="mt-8 border-t border-line pt-4 text-xs text-muted">
          This invoice is issued for the order above. Keep it for your records.
        </p>
      </article>
    </div>
  );
}
