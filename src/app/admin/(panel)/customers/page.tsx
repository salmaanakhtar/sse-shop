import Link from "next/link";
import { Input } from "@/components/ui/field";
import { formatMoney } from "@/lib/money";
import { requireAdminPage } from "@/server/auth/guard";
import { listCustomers } from "@/server/services/customers";

export const metadata = { title: "Customers" };

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdminPage();
  const { q } = await searchParams;
  const customers = await listCustomers(q ?? "");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Customers</h1>

        <form className="flex gap-2">
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name, email, or phone"
            className="w-64"
          />
          <button
            type="submit"
            className="rounded-lg border border-line bg-surface px-3 text-sm text-ink hover:bg-page"
          >
            Search
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {customers.length === 0 ? (
          <p className="px-5 py-10 text-sm text-muted">
            {q ? "No customers match that search." : "No customers yet."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">Customer</th>
                <th className="hidden px-5 py-3 font-semibold md:table-cell">Phone</th>
                <th className="px-5 py-3 font-semibold">Orders</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">Spent</th>
                <th className="hidden px-5 py-3 font-semibold lg:table-cell">Last order</th>
                <th className="px-5 py-3 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-page/60">
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/customers/${customer.id}`}
                      className="font-medium hover:text-brand"
                    >
                      {customer.name}
                    </Link>
                    <p className="text-xs text-muted">{customer.email}</p>
                    {customer.deletedAt ? (
                      <span className="mt-1 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-600 uppercase">
                        Deleted
                      </span>
                    ) : null}
                  </td>
                  <td className="hidden px-5 py-3 text-muted md:table-cell">
                    {customer.phone ?? "—"}
                  </td>
                  <td className="px-5 py-3 tabular-nums">{customer.orderCount}</td>
                  <td className="hidden px-5 py-3 tabular-nums sm:table-cell">
                    {formatMoney(customer.totalSpentMinor)}
                  </td>
                  <td className="hidden px-5 py-3 text-muted lg:table-cell">
                    {customer.lastOrderAt
                      ? new Date(customer.lastOrderAt).toLocaleDateString("en-AE", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {customer.createdAt.toLocaleDateString("en-AE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
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
