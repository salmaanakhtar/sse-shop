import { and, desc, eq, gte, ne, sql } from "drizzle-orm";
import { fail, ok, type Result } from "@/lib/result";
import { db } from "../db/client";
import {
  analyticsEvents,
  campaignSends,
  orders,
  orderItems,
  products,
  variants,
} from "../db/schema";
import { getStoreSettings } from "./settings";

const PRODUCT_PATH = /^\/(?:ar\/)?products\/([^/?#]+)\/?$/;

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function recordPageView(input: {
  path: string;
  visitorHash: string;
  userId?: string | null;
}): Promise<Result<{ recorded: true }>> {
  const path = input.path.slice(0, 500);
  if (!path.startsWith("/") || path.startsWith("//")) {
    return fail("Invalid path.");
  }

  const match = PRODUCT_PATH.exec(path);
  let productId: string | null = null;
  let type: "page_view" | "product_view" = "page_view";

  if (match?.[1]) {
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, decodeURIComponent(match[1])))
      .limit(1);
    if (product) {
      productId = product.id;
      type = "product_view";
    }
  }

  await db.insert(analyticsEvents).values({
    type,
    path,
    productId,
    visitorHash: input.visitorHash,
    userId: input.userId ?? null,
  });

  return ok({ recorded: true });
}

export async function recordOrderPlaced(input: {
  orderId: string;
  valueMinor: number;
  visitorHash: string;
  userId?: string | null;
}): Promise<void> {
  await db.insert(analyticsEvents).values({
    type: "order_placed",
    path: "/checkout/success",
    orderId: input.orderId,
    valueMinor: input.valueMinor,
    visitorHash: input.visitorHash,
    userId: input.userId ?? null,
  });
}

export type DailyPoint = {
  day: string;
  revenueMinor: number;
  orders: number;
  views: number;
  productViews: number;
};

export type AnalyticsSummary = {
  from: Date;
  to: Date;
  days: number;
  revenueMinor: number;
  orderCount: number;
  averageOrderMinor: number;
  pageViews: number;
  productViews: number;
  conversionPercent: number;
  lowStockCount: number;
  campaignEmails: number;
  daily: DailyPoint[];
  topProducts: { title: string; quantity: number; revenueMinor: number }[];
  topPages: { path: string; views: number }[];
};

export async function getAnalyticsSummary(days: number): Promise<AnalyticsSummary> {
  const windowDays = [7, 30, 90].includes(days) ? days : 30;
  const to = new Date();
  const from = new Date();
  from.setUTCHours(0, 0, 0, 0);
  from.setUTCDate(from.getUTCDate() - (windowDays - 1));

  const settings = await getStoreSettings();

  const [totalsRows, viewRows, orderEvents, viewEvents, productRows, pageRows, campaignRows, lowStockRows] =
    await Promise.all([
      db
        .select({
          revenue: sql<number>`coalesce(sum(${orders.totalMinor}), 0)::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(orders)
        .where(and(gte(orders.placedAt, from), ne(orders.status, "cancelled"))),
      db
        .select({ type: analyticsEvents.type, count: sql<number>`count(*)::int` })
        .from(analyticsEvents)
        .where(
          and(
            gte(analyticsEvents.createdAt, from),
            sql`${analyticsEvents.type} in ('page_view', 'product_view')`,
          ),
        )
        .groupBy(analyticsEvents.type),
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${orders.placedAt}), 'YYYY-MM-DD')`,
          revenue: sql<number>`coalesce(sum(${orders.totalMinor}), 0)::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(orders)
        .where(and(gte(orders.placedAt, from), ne(orders.status, "cancelled")))
        .groupBy(sql`date_trunc('day', ${orders.placedAt})`),
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${analyticsEvents.createdAt}), 'YYYY-MM-DD')`,
          type: analyticsEvents.type,
          count: sql<number>`count(*)::int`,
        })
        .from(analyticsEvents)
        .where(
          and(
            gte(analyticsEvents.createdAt, from),
            sql`${analyticsEvents.type} in ('page_view', 'product_view')`,
          ),
        )
        .groupBy(
          sql`date_trunc('day', ${analyticsEvents.createdAt})`,
          analyticsEvents.type,
        ),
      db
        .select({
          title: orderItems.title,
          quantity: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
          revenue: sql<number>`coalesce(sum(${orderItems.lineTotalMinor}), 0)::int`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(and(gte(orders.placedAt, from), ne(orders.status, "cancelled")))
        .groupBy(orderItems.title)
        .orderBy(desc(sql`sum(${orderItems.lineTotalMinor})`))
        .limit(5),
      db
        .select({ path: analyticsEvents.path, views: sql<number>`count(*)::int` })
        .from(analyticsEvents)
        .where(and(gte(analyticsEvents.createdAt, from), eq(analyticsEvents.type, "page_view")))
        .groupBy(analyticsEvents.path)
        .orderBy(desc(sql`count(*)`))
        .limit(5),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(campaignSends)
        .where(and(gte(campaignSends.createdAt, from), eq(campaignSends.status, "sent"))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(variants)
        .where(
          and(
            eq(variants.active, true),
            sql`${variants.stockQty} <= coalesce(${variants.lowStockThreshold}, ${settings.lowStockThreshold})`,
          ),
        ),
    ]);

  const totals = totalsRows[0];
  const revenueMinor = totals?.revenue ?? 0;
  const orderCount = totals?.count ?? 0;

  const viewByType = new Map(viewRows.map((row) => [row.type, row.count]));
  const pageViews = viewByType.get("page_view") ?? 0;
  const productViews = viewByType.get("product_view") ?? 0;

  const dailyMap = new Map<string, DailyPoint>();
  for (let index = 0; index < windowDays; index += 1) {
    const date = new Date(from);
    date.setUTCDate(from.getUTCDate() + index);
    dailyMap.set(dayKey(date), {
      day: dayKey(date),
      revenueMinor: 0,
      orders: 0,
      views: 0,
      productViews: 0,
    });
  }

  for (const row of orderEvents) {
    const point = dailyMap.get(row.day);
    if (point) {
      point.revenueMinor = row.revenue;
      point.orders = row.count;
    }
  }
  for (const row of viewEvents) {
    const point = dailyMap.get(row.day);
    if (!point) continue;
    if (row.type === "product_view") point.productViews += row.count;
    else point.views += row.count;
  }

  return {
    from,
    to,
    days: windowDays,
    revenueMinor,
    orderCount,
    averageOrderMinor: orderCount > 0 ? Math.round(revenueMinor / orderCount) : 0,
    pageViews,
    productViews,
    conversionPercent: pageViews > 0 ? Math.round((orderCount / pageViews) * 1_000) / 10 : 0,
    lowStockCount: lowStockRows[0]?.count ?? 0,
    campaignEmails: campaignRows[0]?.count ?? 0,
    daily: [...dailyMap.values()],
    topProducts: productRows.map((row) => ({
      title: row.title,
      quantity: row.quantity,
      revenueMinor: row.revenue,
    })),
    topPages: pageRows,
  };
}
