import { describe, expect, it } from "vitest";
import type { PromotionTargetType } from "@/lib/promotions";
import { db } from "@/server/db/client";
import { categories, collections, products, promotions, variants } from "@/server/db/schema";
import {
  deletePromotion,
  getPromotion,
  getPromotionTarget,
  listActivePromotions,
  listAdminPromotions,
  movePromotion,
} from "@/server/services/promotions";

const suffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function createProduct(title: string, status: "active" | "draft" = "active") {
  const [product] = await db
    .insert(products)
    .values({
      slug: `promo-product-${suffix()}`,
      title,
      status,
      publishedAt: status === "active" ? new Date() : null,
    })
    .returning();
  if (!product) throw new Error("could not create the test product");

  await db.insert(variants).values({
    productId: product.id,
    sku: `PROMO-${suffix()}`,
    title: "Default",
    priceMinor: 10_000,
    stockQty: 3,
  });

  return product;
}

async function createCategoryRow(active: boolean) {
  const [row] = await db
    .insert(categories)
    .values({
      name: `Category ${suffix()}`,
      slug: `promo-category-${suffix()}`,
      active,
    })
    .returning();
  if (!row) throw new Error("could not create the test category");
  return row;
}

async function createCollectionRow(active: boolean) {
  const [row] = await db
    .insert(collections)
    .values({
      name: `Collection ${suffix()}`,
      slug: `promo-collection-${suffix()}`,
      active,
    })
    .returning();
  if (!row) throw new Error("could not create the test collection");
  return row;
}

async function createPromotionRow(input: {
  headline: string;
  position: number;
  targetType: PromotionTargetType;
  targetId: string;
  active?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
}) {
  const [row] = await db
    .insert(promotions)
    .values({
      headline: input.headline,
      subheadline: "",
      ctaLabel: "Shop now",
      targetType: input.targetType,
      targetId: input.targetId,
      imageKey: `2026/11/${suffix()}.webp`,
      imageAlt: input.headline,
      active: input.active ?? true,
      position: input.position,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
    })
    .returning();
  if (!row) throw new Error("could not create the test promotion");
  return row;
}

describe("promotions", () => {
  it("resolves entity targets and lists only live slides with an active destination", async () => {
    const now = new Date("2026-06-01T12:00:00.000Z");

    const activeProduct = await createProduct("Active product");
    const draftProduct = await createProduct("Draft product", "draft");
    const activeCategory = await createCategoryRow(true);
    const inactiveCategory = await createCategoryRow(false);
    const activeCollection = await createCollectionRow(true);
    const inactiveCollection = await createCollectionRow(false);

    const second = await createPromotionRow({
      headline: "Second",
      position: 1,
      targetType: "product",
      targetId: activeProduct.id,
    });
    const first = await createPromotionRow({
      headline: "First",
      position: 0,
      targetType: "collection",
      targetId: activeCollection.id,
    });
    await createPromotionRow({
      headline: "Future",
      position: 2,
      targetType: "category",
      targetId: activeCategory.id,
      startsAt: new Date("2026-06-02T00:00:00.000Z"),
    });
    await createPromotionRow({
      headline: "Expired",
      position: 3,
      targetType: "collection",
      targetId: activeCollection.id,
      endsAt: new Date("2026-06-01T11:00:00.000Z"),
    });
    await createPromotionRow({
      headline: "Inactive",
      position: 4,
      targetType: "product",
      targetId: activeProduct.id,
      active: false,
    });
    await createPromotionRow({
      headline: "Draft target",
      position: 5,
      targetType: "product",
      targetId: draftProduct.id,
    });
    await createPromotionRow({
      headline: "Inactive category",
      position: 6,
      targetType: "category",
      targetId: inactiveCategory.id,
    });
    await createPromotionRow({
      headline: "Inactive collection",
      position: 7,
      targetType: "collection",
      targetId: inactiveCollection.id,
    });
    const missing = await createPromotionRow({
      headline: "Missing",
      position: 8,
      targetType: "product",
      targetId: "01a1d45e-0000-7000-8000-000000000000",
    });

    const live = await listActivePromotions(now);
    expect(live.map((slide) => slide.headline)).toEqual(["First", "Second"]);
    expect(live[0]?.href).toBe(`/collections/${activeCollection.slug}`);
    expect(live[1]?.href).toBe(`/products/${activeProduct.slug}`);

    const admin = await listAdminPromotions();
    const byId = new Map(admin.map((row) => [row.id, row]));
    expect(byId.get(first.id)?.target?.label).toBe(activeCollection.name);
    expect(byId.get(second.id)?.status).toBe("live");
    expect(byId.get(missing.id)?.target?.missing).toBe(true);

    expect(await getPromotionTarget("product", activeProduct.id)).toMatchObject({
      label: "Active product",
      href: `/products/${activeProduct.slug}`,
    });
    expect(await getPromotionTarget("category", activeProduct.id)).toBeNull();
    expect(await getPromotionTarget("unknown", activeProduct.id)).toBeNull();

    const fetched = await getPromotion(second.id);
    expect(fetched?.target?.href).toBe(`/products/${activeProduct.slug}`);

    expect(await movePromotion(second.id, "up")).toBe(true);
    const reordered = await listActivePromotions(now);
    expect(reordered.map((slide) => slide.headline)).toEqual(["Second", "First"]);

    const deleted = await deletePromotion(first.id);
    expect(deleted?.id).toBe(first.id);
    expect((await listAdminPromotions()).some((row) => row.id === first.id)).toBe(false);
  });

  it("keeps a legacy row without a destination inactive", async () => {
    await db.delete(promotions);

    const [row] = await db
      .insert(promotions)
      .values({
        headline: "Legacy",
        ctaLabel: "Shop now",
        targetType: "product",
        targetId: null,
        imageKey: `2026/11/${suffix()}.webp`,
        active: true,
        position: 0,
      })
      .returning();

    expect(row).toBeDefined();
    expect(await listActivePromotions()).toEqual([]);

    const admin = await listAdminPromotions();
    expect(admin[0]?.target).toBeNull();
    expect(admin[0]?.status).toBe("live");
  });
});
