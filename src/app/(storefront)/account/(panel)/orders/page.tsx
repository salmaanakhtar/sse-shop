import Link from "next/link";
import { orderStatusLabel } from "@/components/storefront/order-detail";
import { buttonClass } from "@/components/ui/button";
import { formatDateFor, localePath, translate } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { requireUserPage } from "@/server/auth/guard";
import { listOrdersForCustomer } from "@/server/services/orders";
import { getLocale, getNumeralPreference } from "@/server/services/preferences";

export const metadata = { title: "Your orders" };

export default async function AccountOrdersPage() {
  const session = await requireUserPage();
  const [orders, locale, numerals] = await Promise.all([
    listOrdersForCustomer(session.user.id),
    getLocale(),
    getNumeralPreference(),
  ]);
  const money = (minor: number) => formatMoney(minor, { locale, numerals });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{translate(locale, "orders.title")}</h2>
        <Link
          href={localePath(locale, "/account/orders/claim")}
          className={buttonClass("secondary", "sm")}
        >
          {translate(locale, "orders.claim")}
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {orders.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-muted">{translate(locale, "account.noOrders")}</p>
            <Link
              href={localePath(locale, "/")}
              className={buttonClass("primary", "sm", "mt-4")}
            >
              {translate(locale, "account.browse")}
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase rtl:text-right">
              <tr>
                <th className="px-5 py-3 font-semibold">{translate(locale, "orders.number")}</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">
                  {translate(locale, "orders.placed")}
                </th>
                <th className="px-5 py-3 font-semibold">{translate(locale, "orders.status")}</th>
                <th className="hidden px-5 py-3 font-semibold md:table-cell">
                  {translate(locale, "orders.items")}
                </th>
                <th className="px-5 py-3 text-right font-semibold rtl:text-left">
                  {translate(locale, "orders.total")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-page/60">
                  <td className="px-5 py-3">
                    <Link
                      href={localePath(locale, `/account/orders/${order.number}`)}
                      className="font-medium hover:text-brand"
                    >
                      {order.number}
                    </Link>
                  </td>
                  <td className="hidden px-5 py-3 text-muted sm:table-cell">
                    {formatDateFor(order.placedAt, locale, numerals, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-3">{orderStatusLabel(locale, order.status)}</td>
                  <td className="hidden px-5 py-3 tabular-nums md:table-cell">
                    {order.itemCount}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums rtl:text-left">
                    {money(order.totalMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted">{translate(locale, "orders.guestNote")}</p>
    </div>
  );
}
