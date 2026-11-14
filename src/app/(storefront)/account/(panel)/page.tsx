import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { setMarketingConsentAction } from "@/app/(storefront)/account/actions";
import { ProfileForm } from "@/components/storefront/profile-form";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { requireUserPage } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { listAddresses } from "@/server/services/addresses";
import {
  getCustomerOrderStats,
  listOrdersForCustomer,
} from "@/server/services/orders";

export default async function AccountOverviewPage() {
  const session = await requireUserPage();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) redirect("/account/sign-in");

  const [stats, addresses, orders] = await Promise.all([
    getCustomerOrderStats(user.id),
    listAddresses(user.id),
    listOrdersForCustomer(user.id),
  ]);

  const recent = orders.slice(0, 3);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/account/orders"
          className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-brand/40"
        >
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Orders</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{stats.orderCount}</p>
        </Link>
        <Link
          href="/account/orders"
          className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-brand/40"
        >
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Total spent</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {formatMoney(stats.totalSpentMinor)}
          </p>
        </Link>
        <Link
          href="/account/addresses"
          className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-brand/40"
        >
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">
            Saved addresses
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{addresses.length}</p>
        </Link>
      </div>

      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">Profile</h2>
        <div className="mt-4 max-w-md">
          <ProfileForm name={user.name} email={user.email} phone={user.phone ?? ""} />
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">Marketing emails</h2>
        <p className="mt-2 max-w-lg text-sm text-muted">
          Occasional product news and offers. Abandoned-cart reminders use this permission too.
          Every campaign has a one-click unsubscribe.
        </p>
        <form action={setMarketingConsentAction} className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="marketingConsent"
              defaultChecked={user.marketingConsent}
              className="size-4"
            />
            Email me about new products and offers
          </label>
          <Button type="submit" size="sm" variant="secondary">
            Save preference
          </Button>
        </form>
        <p className="mt-3 text-xs text-muted">
          {user.marketingConsent
            ? `Opted in${user.marketingConsentAt ? ` on ${user.marketingConsentAt.toLocaleDateString("en-AE")}` : ""}.`
            : "Not opted in. Transactional order and stock-alert emails still send."}
        </p>
      </section>

      <section className="rounded-xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold">Recent orders</h2>
          <Link href="/account/orders" className="text-xs text-muted hover:text-ink">
            View all
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">
            No orders yet.{" "}
            <Link href="/" className="underline underline-offset-4 hover:text-ink">
              Browse the shop
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <Link href={`/account/orders/${order.number}`} className="font-medium hover:text-brand">
                  {order.number}
                </Link>
                <span className="text-xs text-muted">
                  {order.placedAt.toLocaleDateString("en-AE", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <span className="tabular-nums">{formatMoney(order.totalMinor)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">Delete account</h2>
        <p className="mt-2 max-w-lg text-sm text-muted">
          This removes your profile, saved addresses, and sign-in. Past orders stay with the store
          for accounting.
        </p>
        <Link
          href="/account/delete"
          className="mt-4 inline-block text-sm text-red-600 underline-offset-4 hover:underline"
        >
          Delete my account
        </Link>
      </section>
    </div>
  );
}
