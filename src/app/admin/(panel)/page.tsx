import Link from "next/link";
import { and, eq, gt, lte, ne, sql } from "drizzle-orm";
import { buttonClass } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { db } from "@/server/db/client";
import { orders, products, variants } from "@/server/db/schema";

export default async function AdminOverviewPage() {
  const [[productCount], [activeCount], [lowStock], [orderCount], recent] = await Promise.all([
    db.select({ value: sql<number>`count(*)::int` }).from(products),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.status, "active")),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(variants)
      .where(and(eq(variants.active, true), lte(variants.stockQty, 5), gt(variants.stockQty, 0))),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(orders)
      .where(ne(orders.status, "cancelled")),
    db.select().from(orders).orderBy(sql`${orders.placedAt} desc`).limit(5),
  ]);

  const stats = [
    { label: "Products", value: productCount?.value ?? 0, href: "/admin/products" },
    { label: "Published", value: activeCount?.value ?? 0, href: "/admin/products" },
    { label: "Low stock", value: lowStock?.value ?? 0, href: "/admin/products" },
    { label: "Orders", value: orderCount?.value ?? 0, href: "/admin/orders" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
        <Link href="/admin/products/new" className={buttonClass("primary", "sm")}>
          New product
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-brand/40"
          >
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{stat.value}</p>
          </Link>
        ))}
      </div>

      <section className="rounded-xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold">Recent orders</h2>
          <Link href="/admin/orders" className="text-xs text-muted hover:text-ink">
            View all
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">
            No orders yet. Place one through the storefront to see it here.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <span className="font-medium">{order.number}</span>
                <span className="hidden flex-1 truncate text-muted sm:block">{order.email}</span>
                <span className="tabular-nums">{formatMoney(order.totalMinor)}</span>
                <span className="w-20 text-right text-xs text-muted capitalize">
                  {order.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
