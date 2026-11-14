import { describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import {
  campaignSends,
  campaigns,
  orderItems,
  orders,
  products,
  variants,
} from "@/server/db/schema";
import {
  getAnalyticsSummary,
  recordOrderPlaced,
  recordPageView,
} from "@/server/services/analytics";

const suffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function createProduct(stockQty = 10) {
  const [product] = await db
    .insert(products)
    .values({
      slug: `analytics-${suffix()}`,
      title: "Analytics Product",
      status: "active",
      publishedAt: new Date(),
    })
    .returning();
  if (!product) throw new Error("could not create the product");

  const [variant] = await db
    .insert(variants)
    .values({
      productId: product.id,
      sku: `ANALYTICS-${suffix()}`,
      title: "Default",
      priceMinor: 12_000,
      stockQty,
    })
    .returning();
  if (!variant) throw new Error("could not create the variant");

  return { product, variant };
}

async function createOrder(variantId: string, totalMinor = 24_000) {
  const [order] = await db
    .insert(orders)
    .values({
      number: `SS-2099-${suffix()}`,
      lookupTokenHash: `hash-${suffix()}`,
      lookupExpiresAt: new Date(Date.now() + 86_400_000),
      email: "analytics@example.com",
      status: "confirmed",
      paymentStatus: "paid",
      subtotalMinor: totalMinor,
      totalMinor,
      shippingAddress: {
        fullName: "Analytics Tester",
        phone: "+971501234567",
        emirate: "Dubai",
        building: "1",
        street: "Test Street",
        area: "",
        poBox: "",
        notes: "",
      },
    })
    .returning();
  if (!order) throw new Error("could not create the order");

  await db.insert(orderItems).values({
    orderId: order.id,
    variantId,
    sku: "ANALYTICS",
    title: "Analytics Product",
    unitPriceMinor: totalMinor,
    quantity: 1,
    lineTotalMinor: totalMinor,
  });

  return order;
}

describe("analytics", () => {
  it("records page and product views without third-party data", async () => {
    const { product } = await createProduct();
    const visitor = `visitor-${suffix()}`;

    expect(
      (await recordPageView({ path: "/", visitorHash: visitor })).ok,
    ).toBe(true);
    expect(
      (await recordPageView({ path: `/products/${product.slug}`, visitorHash: visitor })).ok,
    ).toBe(true);
    expect((await recordPageView({ path: "//evil.example", visitorHash: visitor })).ok).toBe(false);

    const summary = await getAnalyticsSummary(7);
    expect(summary.pageViews).toBe(1);
    expect(summary.productViews).toBe(1);
    expect(summary.topPages[0]?.path).toBe("/");
  });

  it("summarizes revenue, orders, averages, and top products", async () => {
    const { product, variant } = await createProduct();
    const order = await createOrder(variant.id, 24_000);
    await recordOrderPlaced({
      orderId: order.id,
      valueMinor: 24_000,
      visitorHash: `visitor-${suffix()}`,
    });

    const summary = await getAnalyticsSummary(30);

    expect(summary.orderCount).toBe(1);
    expect(summary.revenueMinor).toBe(24_000);
    expect(summary.averageOrderMinor).toBe(24_000);
    expect(summary.topProducts[0]?.title).toBe("Analytics Product");
    expect(summary.topProducts[0]?.revenueMinor).toBe(24_000);
    expect(summary.daily).toHaveLength(30);
    expect(summary.daily.at(-1)?.orders).toBe(1);
    expect(product.id).toBeTruthy();
  });

  it("counts low stock and campaign emails in the window", async () => {
    const { variant } = await createProduct(1);
    expect(variant.id).toBeTruthy();

    const [campaign] = await db
      .insert(campaigns)
      .values({
        subject: "Analytics campaign",
        body: "Body",
        status: "sent",
        sentAt: new Date(),
        recipientCount: 1,
      })
      .returning();
    if (!campaign) throw new Error("could not create the campaign");

    await db.insert(campaignSends).values({
      campaignId: campaign.id,
      email: `analytics-${suffix()}@example.com`,
      status: "sent",
      sentAt: new Date(),
    });

    const summary = await getAnalyticsSummary(7);
    expect(summary.campaignEmails).toBe(1);
    expect(summary.lowStockCount).toBeGreaterThanOrEqual(1);
  });

  it("clamps an unknown range to thirty days", async () => {
    const summary = await getAnalyticsSummary(5_000);
    expect(summary.days).toBe(30);
  });
});
