import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { products, promotions, variants } from "@/server/db/schema";
import {
  addPromotionRow,
  createPromotion,
  deletePromotion,
  deletePromotionRow,
  getActivePromotionPage,
  getPromotion,
  listActivePromotions,
  listAdminPromotions,
  listPromotionRows,
  movePromotion,
  movePromotionRow,
  updatePromotionRowTitle,
} from "@/server/services/promotions";
import { createCategory, setProductCategories } from "@/server/services/categories";
import { addCollectionProduct, createCollection } from "@/server/services/collections";

const suffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function createProduct(title: string) {
  const [product] = await db
    .insert(products)
    .values({
      slug: `promo-product-${suffix()}`,
      title,
      status: "active",
      publishedAt: new Date(),
    })
    .returning();
  if (!product) throw new Error("could not create the test product");

  await db.insert(variants).values({
    productId: product.id,
    sku: `PROMO-${suffix()}`,
    title: "Default",
    priceMinor: 10_000,
    stockQty: 5,
  });

  return product;
}

async function createPromotionPage(input?: {
  active?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
}) {
  const slug = `promo-${suffix()}`;
  const promotion = await createPromotion({
    slug,
    headline: "Hardware Sale",
    subheadline: "Up to 30% off",
    ctaLabel: "Shop the sale",
    imageKey: `2026/11/${suffix()}.webp`,
    imageAlt: "Hardware Sale",
    active: input?.active ?? true,
    startsAt: input?.startsAt ?? null,
    endsAt: input?.endsAt ?? null,
  });
  return { promotion, slug };
}

async function addRow(
  promotionId: string,
  input: Parameters<typeof addPromotionRow>[1],
) {
  const result = await addPromotionRow(promotionId, input);
  if (!result.ok) throw new Error(result.error);
  return result.data.id;
}

describe("promotion pages", () => {
  it("renders ordered category, collection, and product rows without cross-row dedupe", async () => {
    const { promotion, slug } = await createPromotionPage();
    const first = await createProduct("First product");
    const second = await createProduct("Second product");

    const categoryResult = await createCategory({
      name: "Hard Drives",
      slug: `hard-drives-${suffix()}`,
      description: "",
      parentId: null,
      active: true,
    });
    expect(categoryResult.ok).toBe(true);
    if (!categoryResult.ok) return;
    await setProductCategories(first.id, [categoryResult.data.id]);

    const collectionResult = await createCollection({
      name: "Featured Hardware",
      slug: `featured-hardware-${suffix()}`,
      description: "",
      active: true,
    });
    expect(collectionResult.ok).toBe(true);
    if (!collectionResult.ok) return;
    await addCollectionProduct(collectionResult.data.id, first.id);
    await addCollectionProduct(collectionResult.data.id, second.id);

    const categoryRow = await addRow(promotion.id, {
      kind: "category",
      categoryId: categoryResult.data.id,
      title: "Hard Drives",
    });
    void categoryRow;
    const collectionRow = await addRow(promotion.id, {
      kind: "collection",
      collectionId: collectionResult.data.id,
      title: "Featured Hardware",
    });
    const productRow = await addRow(promotion.id, {
      kind: "products",
      productIds: [second.id, first.id, second.id],
      title: "Editor's picks",
    });

    const duplicate = await addPromotionRow(promotion.id, {
      kind: "category",
      categoryId: categoryResult.data.id,
      title: "Another",
    });
    expect(duplicate.ok).toBe(false);

    const page = await getActivePromotionPage(slug);
    expect(page?.rows.map((row) => row.title)).toEqual([
      "Hard Drives",
      "Featured Hardware",
      "Editor's picks",
    ]);
    expect(page?.rows[0]?.products.map((product) => product.id)).toEqual([first.id]);
    expect(page?.rows[1]?.products.map((product) => product.id)).toEqual([
      first.id,
      second.id,
    ]);
    expect(page?.rows[2]?.products.map((product) => product.id)).toEqual([
      second.id,
      first.id,
    ]);

    const live = await listActivePromotions();
    expect(live.find((slide) => slide.id === promotion.id)?.href).toBe(
      `/promotions/${promotion.slug}`,
    );

    const admin = (await listAdminPromotions()).find((row) => row.id === promotion.id);
    expect(admin?.status).toBe("live");
    expect(admin?.href).toBe(`/promotions/${promotion.slug}`);
    expect((await getPromotion(promotion.id))?.slug).toBe(promotion.slug);

    expect(await movePromotionRow(productRow, "up")).toBe(true);
    expect(await updatePromotionRowTitle(productRow, "Handpicked")).toMatchObject({
      ok: true,
      data: { title: "Handpicked" },
    });

    const rows = await listPromotionRows(promotion.id);
    expect(rows.map((row) => row.title)).toEqual([
      "Hard Drives",
      "Handpicked",
      "Featured Hardware",
    ]);
    expect(rows.find((row) => row.id === productRow)?.products).toHaveLength(2);

    expect((await deletePromotionRow(collectionRow)).ok).toBe(true);
    expect((await getActivePromotionPage(slug))?.rows.map((row) => row.title)).toEqual([
      "Hard Drives",
      "Handpicked",
    ]);

    const deleted = await deletePromotion(promotion.id);
    expect(deleted?.id).toBe(promotion.id);
    expect(await getActivePromotionPage(slug)).toBeNull();
    void categoryRow;
  });

  it("hides inactive, scheduled, and expired promotion pages", async () => {
    const inactive = await createPromotionPage({ active: false });
    const scheduled = await createPromotionPage({
      startsAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    const expired = await createPromotionPage({
      endsAt: new Date("2020-01-01T00:00:00.000Z"),
    });

    expect(await getActivePromotionPage(inactive.slug)).toBeNull();
    expect(await getActivePromotionPage(scheduled.slug)).toBeNull();
    expect(await getActivePromotionPage(expired.slug)).toBeNull();

    const live = await listActivePromotions(new Date("2026-06-01T12:00:00.000Z"));
    expect(live.some((slide) => slide.id === inactive.promotion.id)).toBe(false);
    expect(live.some((slide) => slide.id === scheduled.promotion.id)).toBe(false);
    expect(live.some((slide) => slide.id === expired.promotion.id)).toBe(false);
  });

  it("moves a promotion in the carousel and deletes it", async () => {
    await db.delete(promotions);
    const first = await createPromotionPage();
    const second = await createPromotionPage();

    expect(await movePromotion(first.promotion.id, "up")).toBe(false);
    expect(await movePromotion(second.promotion.id, "up")).toBe(true);

    const ordered = (await listAdminPromotions()).map((row) => row.id);
    expect(ordered.slice(0, 2)).toEqual([second.promotion.id, first.promotion.id]);

    const deleted = await deletePromotion(first.promotion.id);
    expect(deleted?.id).toBe(first.promotion.id);
    const [remaining] = await db
      .select()
      .from(promotions)
      .where(eq(promotions.id, second.promotion.id));
    expect(remaining?.id).toBe(second.promotion.id);
  });
});
