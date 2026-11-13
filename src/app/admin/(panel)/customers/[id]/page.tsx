import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { formatAddress } from "@/lib/address";
import { formatMoney } from "@/lib/money";
import { requireAdminPage } from "@/server/auth/guard";
import { getCustomerForAdmin } from "@/server/services/customers";

export const metadata = { title: "Customer" };

export default async function AdminCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const customer = await getCustomerForAdmin(id);

  if (!customer) notFound();

  const { user, addresses, orders, stats } = customer;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{user.name}</h1>
          <p className="mt-1 text-sm text-muted">{user.email}</p>
          <p className="text-xs text-muted">
            Joined{" "}
            {user.createdAt.toLocaleDateString("en-AE", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {user.phone ? ` · ${user.phone}` : ""}
          </p>
          {user.deletedAt ? (
            <span className="mt-2 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-600 uppercase">
              Deleted account
            </span>
          ) : null}
        </div>

        <Link href="/admin/customers" className={buttonClass("ghost", "sm")}>
          All customers
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Orders</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{stats.orderCount}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Total spent</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {formatMoney(stats.totalSpentMinor)}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Addresses</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{addresses.length}</p>
        </div>
      </div>

      <section className="rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold">Orders</h2>
        </div>

        {orders.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">No orders.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">Number</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">Placed</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-5 py-3 font-medium">{order.number}</td>
                  <td className="hidden px-5 py-3 text-muted sm:table-cell">
                    {order.placedAt.toLocaleDateString("en-AE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-3 capitalize">{order.status}</td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {formatMoney(order.totalMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold">Saved addresses</h2>
        </div>

        {addresses.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">No saved addresses.</p>
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {addresses.map((address) => (
              <div key={address.id} className="rounded-lg border border-line p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{address.label || "Address"}</p>
                  <div className="flex gap-1 text-[10px] font-semibold tracking-wide uppercase">
                    {address.isDefaultShipping ? (
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 text-brand">
                        Delivery
                      </span>
                    ) : null}
                    {address.isDefaultBilling ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                        Billing
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 space-y-0.5 text-sm text-muted">
                  {formatAddress(address).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
