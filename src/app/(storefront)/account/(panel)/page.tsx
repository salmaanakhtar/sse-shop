import Link from "next/link";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { setMarketingConsentAction } from "@/app/(storefront)/account/actions";
import { ProfileForm } from "@/components/storefront/profile-form";
import { Button } from "@/components/ui/button";
import { formatDateFor, localePath, translate } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { requireUserPage } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { listAddresses } from "@/server/services/addresses";
import {
  getCustomerOrderStats,
  listOrdersForCustomer,
} from "@/server/services/orders";
import { getLocale, getNumeralPreference } from "@/server/services/preferences";

export default async function AccountOverviewPage() {
  const session = await requireUserPage();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) redirect("/account/sign-in");

  const [stats, addresses, orders, locale, numerals] = await Promise.all([
    getCustomerOrderStats(user.id),
    listAddresses(user.id),
    listOrdersForCustomer(user.id),
    getLocale(),
    getNumeralPreference(),
  ]);
  const money = (minor: number) => formatMoney(minor, { locale, numerals });

  const recent = orders.slice(0, 3);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href={localePath(locale, "/account/orders")}
          className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-brand/40"
        >
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">
            {translate(locale, "account.orders")}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{stats.orderCount}</p>
        </Link>
        <Link
          href={localePath(locale, "/account/orders")}
          className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-brand/40"
        >
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">
            {translate(locale, "account.totalSpent")}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {money(stats.totalSpentMinor)}
          </p>
        </Link>
        <Link
          href={localePath(locale, "/account/addresses")}
          className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-brand/40"
        >
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">
            {translate(locale, "account.savedAddresses")}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{addresses.length}</p>
        </Link>
      </div>

      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">{translate(locale, "account.profile")}</h2>
        <div className="mt-4 max-w-md">
          <ProfileForm name={user.name} email={user.email} phone={user.phone ?? ""} />
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">{translate(locale, "account.marketing")}</h2>
        <p className="mt-2 max-w-lg text-sm text-muted">
          {translate(locale, "account.marketingHelp")}
        </p>
        <form action={setMarketingConsentAction} className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="marketingConsent"
              defaultChecked={user.marketingConsent}
              className="size-4"
            />
            {translate(locale, "account.marketingOptIn")}
          </label>
          <Button type="submit" size="sm" variant="secondary">
            {translate(locale, "account.savePreference")}
          </Button>
        </form>
        <p className="mt-3 text-xs text-muted">
          {user.marketingConsent
            ? user.marketingConsentAt
              ? translate(locale, "account.optedInOn", {
                  date: formatDateFor(user.marketingConsentAt, locale, numerals),
                })
              : translate(locale, "account.optedIn")
            : translate(locale, "account.notOptedIn")}
        </p>
      </section>

      <section className="rounded-xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold">{translate(locale, "account.recentOrders")}</h2>
          <Link
            href={localePath(locale, "/account/orders")}
            className="text-xs text-muted hover:text-ink"
          >
            {translate(locale, "account.viewAll")}
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">
            {translate(locale, "account.noOrders")}{" "}
            <Link
              href={localePath(locale, "/")}
              className="underline underline-offset-4 hover:text-ink"
            >
              {translate(locale, "account.browse")}
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <Link
                  href={localePath(locale, `/account/orders/${order.number}`)}
                  className="font-medium hover:text-brand"
                >
                  {order.number}
                </Link>
                <span className="text-xs text-muted">
                  {formatDateFor(order.placedAt, locale, numerals, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <span className="tabular-nums">{money(order.totalMinor)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">{translate(locale, "account.deleteAccount")}</h2>
        <p className="mt-2 max-w-lg text-sm text-muted">
          {translate(locale, "account.deleteBody")}
        </p>
        <Link
          href={localePath(locale, "/account/delete")}
          className="mt-4 inline-block text-sm text-red-600 underline-offset-4 hover:underline"
        >
          {translate(locale, "account.deleteMine")}
        </Link>
      </section>
    </div>
  );
}
