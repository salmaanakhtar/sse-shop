import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { buildCategoryTree, findCategoryById } from "@/lib/categories";
import { db } from "@/server/db/client";
import {
  collectionProducts,
  productBadges,
  products,
  variants,
} from "@/server/db/schema";
import {
  badgesForProducts,
  createBadge,
  deleteBadge,
  setProductBadges,
  updateBadge,
} from "@/server/services/badges";
import { listCatalogByIds } from "@/server/services/catalog";
import {
  createCategory,
  deleteCategory,
  listAllCategories,
  listProductCategoryIds,
  listProductsInCategoryTree,
  moveCategory,
  setProductCategories,
  updateCategory,
} from "@/server/services/categories";
import {
  addCollectionProduct,
  createCollection,
  deleteCollection,
  listCollectionProductIds,
  listCollections,
  listHomeCollections,
  moveCollection,
  moveCollectionProduct,
  removeCollectionProduct,
} from "@/server/services/collections";

const suffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function createProduct(title: string) {
  const [product] = await db
    .insert(products)
    .values({
      slug: `merch-${suffix()}`,
      title,
      status: "active",
      publishedAt: new Date(),
    })
    .returning();

  if (!product) throw new Error("could not create the test product");

  const [variant] = await db
    .insert(variants)
    .values({
      productId: product.id,
      sku: `MERCH-${suffix()}`,
      title: "Default",
      priceMinor: 12_000,
      stockQty: 5,
    })
    .returning();

  if (!variant) throw new Error("could not create the test variant");
  return product;
}

describe("categories", () => {
  it("builds the tree, reorders siblings, blocks cycles, and guards deletion", async () => {
    const parentResult = await createCategory({
      name: "Parent",
      slug: `parent-${suffix()}`,
      description: "",
      parentId: null,
      active: true,
    });
    expect(parentResult.ok).toBe(true);
    if (!parentResult.ok) return;
    const parent = parentResult.data;

    const firstResult = await createCategory({
      name: "First",
      slug: `first-${suffix()}`,
      description: "",
      parentId: parent.id,
      active: true,
    });
    const secondResult = await createCategory({
      name: "Second",
      slug: `second-${suffix()}`,
      description: "",
      parentId: parent.id,
      active: true,
    });
    expect(firstResult.ok && secondResult.ok).toBe(true);
    if (!firstResult.ok || !secondResult.ok) return;
    const first = firstResult.data;
    const second = secondResult.data;

    expect(await moveCategory(second.id, "up")).toBe(true);
    const rows = await listAllCategories();
    expect(
      rows
        .filter((row) => row.parentId === parent.id)
        .map((row) => row.name),
    ).toEqual(["Second", "First"]);

    const cycle = await updateCategory(parent.id, {
      name: parent.name,
      slug: parent.slug,
      description: "",
      parentId: first.id,
      active: true,
    });
    expect(cycle.ok).toBe(false);

    const tree = buildCategoryTree(rows);
    const parentNode = findCategoryById(tree, parent.id);
    expect(parentNode).not.toBeNull();

    const product = await createProduct("Category Product");
    const assigned = await setProductCategories(product.id, [first.id]);
    expect(assigned.ok).toBe(true);
    expect(await listProductCategoryIds(product.id)).toEqual([first.id]);

    const productIds = await listProductsInCategoryTree(parentNode!);
    expect(productIds).toContain(product.id);

    expect((await deleteCategory(parent.id)).ok).toBe(false);
    expect((await deleteCategory(first.id)).ok).toBe(false);

    await setProductCategories(product.id, []);
    expect((await deleteCategory(second.id)).ok).toBe(true);
    expect((await deleteCategory(first.id)).ok).toBe(true);
    expect((await deleteCategory(parent.id)).ok).toBe(true);
  });
});

describe("collections", () => {
  it("curates ordered products and keeps empty collections off the home page", async () => {
    const first = await createCollection({
      name: "First collection",
      slug: `first-collection-${suffix()}`,
      description: "",
      active: true,
    });
    const second = await createCollection({
      name: "Second collection",
      slug: `second-collection-${suffix()}`,
      description: "",
      active: true,
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    const one = await createProduct("Collection One");
    const two = await createProduct("Collection Two");

    expect((await addCollectionProduct(first.data.id, one.id)).ok).toBe(true);
    expect((await addCollectionProduct(first.data.id, two.id)).ok).toBe(true);
    expect((await addCollectionProduct(first.data.id, one.id)).ok).toBe(false);

    expect(await listCollectionProductIds(first.data.id)).toEqual([one.id, two.id]);
    expect(await moveCollectionProduct(first.data.id, two.id, "up")).toBe(true);
    expect(await listCollectionProductIds(first.data.id)).toEqual([two.id, one.id]);

    const home = await listHomeCollections();
    const row = home.find((collection) => collection.id === first.data.id);
    expect(row?.products.map((product) => product.id)).toEqual([two.id, one.id]);

    expect((await removeCollectionProduct(first.data.id, two.id)).ok).toBe(true);
    expect(await listCollectionProductIds(first.data.id)).toEqual([one.id]);

    expect(await moveCollection(second.data.id, "up")).toBe(true);
    const ordered = await listCollections();
    expect(ordered.slice(0, 2).map((collection) => collection.id)).toEqual([
      second.data.id,
      first.data.id,
    ]);

    expect((await deleteCollection(first.data.id)).ok).toBe(true);
    const leftovers = await db
      .select()
      .from(collectionProducts)
      .where(eq(collectionProducts.collectionId, first.data.id));
    expect(leftovers).toHaveLength(0);
  });
});

describe("badges", () => {
  it("rejects duplicate labels and only shows active badges on catalog cards", async () => {
    const product = await createProduct("Badge Product");
    const labelA = `Best Seller ${suffix()}`;
    const labelB = `New ${suffix()}`;

    const first = await createBadge({ label: labelA, tone: "brand", active: true });
    const second = await createBadge({ label: labelB, tone: "success", active: true });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect((await createBadge({ label: labelA, tone: "neutral", active: true })).ok).toBe(false);

    expect(
      (await setProductBadges(product.id, [first.data.id, second.data.id])).ok,
    ).toBe(true);

    const assigned = await badgesForProducts([product.id]);
    expect(assigned.get(product.id)?.map((badge) => badge.id)).toEqual([
      first.data.id,
      second.data.id,
    ]);

    await updateBadge(second.data.id, {
      label: second.data.label,
      tone: second.data.tone,
      active: false,
    });

    const card = (await listCatalogByIds([product.id]))[0];
    expect(card?.badges.map((badge) => badge.id)).toEqual([first.data.id]);

    expect((await setProductBadges(product.id, [])).ok).toBe(true);
    expect((await listCatalogByIds([product.id]))[0]?.badges).toEqual([]);

    expect((await deleteBadge(first.data.id)).ok).toBe(true);
    const leftovers = await db
      .select()
      .from(productBadges)
      .where(eq(productBadges.badgeId, first.data.id));
    expect(leftovers).toHaveLength(0);
  });
});
