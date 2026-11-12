import { formatMoney } from "@/lib/money";
import { listRecentOrdersForAdmin } from "@/server/services/orders";

export default async function AdminOrdersPage() {
  const recent = await listRecentOrdersForAdmin(100);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Orders</h1>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {recent.length === 0 ? (
          <p className="px-5 py-10 text-sm text-muted">No orders yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">Number</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">Email</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Payment</th>
                <th className="px-5 py-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {recent.map((order) => (
                <tr key={order.id}>
                  <td className="px-5 py-3 font-medium">{order.number}</td>
                  <td className="hidden max-w-56 truncate px-5 py-3 text-muted sm:table-cell">
                    {order.email}
                  </td>
                  <td className="px-5 py-3 capitalize">{order.status}</td>
                  <td className="px-5 py-3 capitalize">{order.paymentStatus}</td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {formatMoney(order.totalMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
