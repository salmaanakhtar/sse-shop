import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { requireAdminPage } from "@/server/auth/guard";
import { getAnalyticsSummary } from "@/server/services/analytics";

export const metadata = { title: "Analytics" };

function shortDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return date.toLocaleDateString("en-AE", { day: "numeric", month: "short", timeZone: "UTC" });
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireAdminPage();
  const { days } = await searchParams;
  const requested = Number(days);
  const summary = await getAnalyticsSummary(Number.isFinite(requested) ? requested : 30);

  const maxRevenue = Math.max(1, ...summary.daily.map((point) => point.revenueMinor));
  const cards = [
    { label: "Revenue", value: formatMoney(summary.revenueMinor) },
    { label: "Orders", value: String(summary.orderCount) },
    { label: "Average order", value: formatMoney(summary.averageOrderMinor) },
    { label: "Page views", value: String(summary.pageViews) },
    { label: "Product views", value: String(summary.productViews) },
    { label: "Orders / page views", value: `${summary.conversionPercent}%` },
    { label: "Low stock", value: String(summary.lowStockCount) },
    { label: "Campaign emails", value: String(summary.campaignEmails) },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted">
            First-party events in Postgres. Visitors are grouped by a daily rotated hash; there is no
            third-party tracker.
          </p>
        </div>
        <nav className="flex gap-2" aria-label="Date range">
          {[7, 30, 90].map((option) => (
            <Link
              key={option}
              href={`/admin/analytics?days=${option}`}
              className={buttonClass(summary.days === option ? "primary" : "secondary", "sm")}
            >
              {option} days
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-line bg-surface p-5">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Revenue by day</h2>
          <p className="text-xs text-muted">
            {summary.from.toLocaleDateString("en-AE")} – {summary.to.toLocaleDateString("en-AE")}
          </p>
        </div>

        <div className="mt-6 flex h-40 items-end gap-[3px] overflow-x-auto">
          {summary.daily.map((point) => {
            const height = point.revenueMinor === 0 ? 2 : Math.max(4, (point.revenueMinor / maxRevenue) * 100);
            return (
              <div
                key={point.day}
                className="group relative flex min-w-[8px] flex-1 flex-col justify-end"
                title={`${shortDay(point.day)} · ${formatMoney(point.revenueMinor)} · ${point.orders} orders`}
              >
                <div
                  className="w-full rounded-t bg-brand/80 transition-colors group-hover:bg-brand"
                  style={{ height: `${height}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted">
          <span>{shortDay(summary.daily[0]?.day ?? "")}</span>
          <span>{shortDay(summary.daily.at(-1)?.day ?? "")}</span>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">Top products</h2>
          {summary.topProducts.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No orders in this range.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {summary.topProducts.map((product) => (
                <li key={product.title} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">{product.title}</span>
                  <span className="shrink-0 text-right tabular-nums">
                    {product.quantity} × · {formatMoney(product.revenueMinor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">Most viewed pages</h2>
          {summary.topPages.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No page views in this range.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {summary.topPages.map((page) => (
                <li key={page.path} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate font-mono text-xs">{page.path}</span>
                  <span className="shrink-0 tabular-nums">{page.views}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="text-xs text-muted">
        Order counts exclude cancelled orders. Conversion is orders divided by page views, not a
        session-based rate; page views come from the storefront beacon.
      </p>
    </div>
  );
}
