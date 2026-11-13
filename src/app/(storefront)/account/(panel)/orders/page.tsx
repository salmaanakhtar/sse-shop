import Link from "next/link";
import { ORDER_STATUS_LABEL } from "@/components/storefront/order-detail";
import { buttonClass } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { requireUserPage } from "@/server/auth/guard";
import { listOrdersForCustomer } from "@/server/services/orders";

export const metadata = { title: "Your orders" };

export default async function AccountOrdersPage() {
  const session = await requireUserPage();
  const orders = await listOrdersForCustomer(session.user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Orders</h2>
        <Link href="/account/orders/claim" className={buttonClass("secondary", "sm")}>
          Claim a guest order
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {orders.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-muted">No orders yet.</p>
            <Link href="/" className={buttonClass("primary", "sm", "mt-4")}>
              Browse the shop
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">Number</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">Placed</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="hidden px-5 py-3 font-semibold md:table-cell">Items</th>
                <th className="px-5 py-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-page/60">
                  <td className="px-5 py-3">
                    <Link
                      href={`/account/orders/${order.number}`}
                      className="font-medium hover:text-brand"
                    >
                      {order.number}
                    </Link>
                  </td>
                  <td className="hidden px-5 py-3 text-muted sm:table-cell">
                    {order.placedAt.toLocaleDateString("en-AE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-3">
                    {ORDER_STATUS_LABEL[order.status] ?? order.status}
                  </td>
                  <td className="hidden px-5 py-3 tabular-nums md:table-cell">
                    {order.itemCount}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {formatMoney(order.totalMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted">
        Guest orders are not shown until you claim them with the order number and lookup token.
      </p>
    </div>
  );
}
