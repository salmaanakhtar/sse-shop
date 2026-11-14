import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "../db/client";
import { collectionProducts, productCategories } from "../db/schema";
import { listCatalog, type CatalogCard } from "./catalog";

/**
 * Related products: shared categories first, then shared collections, then the
 * newest active products as a fallback. The current product is always excluded.
 */
export async function listRelatedProducts(
  productId: string,
  limit = 4,
): Promise<CatalogCard[]> {
  const catalog = await listCatalog();
  const current = catalog.find((product) => product.id === productId);
  if (!current) return [];

  const [categoryRows, collectionRows] = await Promise.all([
    db
      .select({ categoryId: productCategories.categoryId })
      .from(productCategories)
      .where(eq(productCategories.productId, productId)),
    db
      .select({ collectionId: collectionProducts.collectionId })
      .from(collectionProducts)
      .where(eq(collectionProducts.productId, productId)),
  ]);

  const scores = new Map<string, number>();

  if (categoryRows.length > 0) {
    const categoryIds = categoryRows.map((row) => row.categoryId);
    const rows = await db
      .select({ productId: productCategories.productId })
      .from(productCategories)
      .where(
        and(
          inArray(productCategories.categoryId, categoryIds),
          ne(productCategories.productId, productId),
        ),
      );
    for (const row of rows) {
      scores.set(row.productId, (scores.get(row.productId) ?? 0) + 2);
    }
  }

  if (collectionRows.length > 0) {
    const collectionIds = collectionRows.map((row) => row.collectionId);
    const rows = await db
      .select({ productId: collectionProducts.productId })
      .from(collectionProducts)
      .where(
        and(
          inArray(collectionProducts.collectionId, collectionIds),
          ne(collectionProducts.productId, productId),
        ),
      );
    for (const row of rows) {
      scores.set(row.productId, (scores.get(row.productId) ?? 0) + 1);
    }
  }

  const ranked = catalog
    .filter((product) => product.id !== productId)
    .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));

  return ranked.slice(0, limit);
}
