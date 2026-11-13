import { and, asc, eq, sql } from "drizzle-orm";
import { fail, ok, type Result } from "@/lib/result";
import { db } from "../db/client";
import { collectionProducts, collections, products } from "../db/schema";
import { listCatalogByIds, type CatalogCard } from "./catalog";

export type CollectionRecord = typeof collections.$inferSelect;

export type AdminCollectionRow = CollectionRecord & { productCount: number };

export type AdminCollectionProduct = {
  id: string;
  title: string;
  slug: string;
  status: (typeof products.$inferSelect)["status"];
  position: number;
};

export type HomeCollection = {
  id: string;
  name: string;
  slug: string;
  description: string;
  products: CatalogCard[];
};

export async function listCollections(): Promise<CollectionRecord[]> {
  return db
    .select()
    .from(collections)
    .orderBy(asc(collections.position), asc(collections.name));
}

export async function listAdminCollections(): Promise<AdminCollectionRow[]> {
  const [rows, counts] = await Promise.all([
    listCollections(),
    db
      .select({
        collectionId: collectionProducts.collectionId,
        productCount: sql<number>`count(*)::int`,
      })
      .from(collectionProducts)
      .groupBy(collectionProducts.collectionId),
  ]);

  const byCollection = new Map(counts.map((row) => [row.collectionId, row.productCount]));

  return rows.map((row) => ({
    ...row,
    productCount: byCollection.get(row.id) ?? 0,
  }));
}

export async function listActiveCollections(): Promise<CollectionRecord[]> {
  return db
    .select()
    .from(collections)
    .where(eq(collections.active, true))
    .orderBy(asc(collections.position), asc(collections.name));
}

export async function getCollection(id: string): Promise<CollectionRecord | null> {
  const [row] = await db.select().from(collections).where(eq(collections.id, id)).limit(1);
  return row ?? null;
}

export async function getActiveCollectionBySlug(
  slug: string,
): Promise<CollectionRecord | null> {
  const [row] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.slug, slug), eq(collections.active, true)))
    .limit(1);

  return row ?? null;
}

export async function listCollectionProductIds(collectionId: string): Promise<string[]> {
  const rows = await db
    .select({ productId: collectionProducts.productId })
    .from(collectionProducts)
    .where(eq(collectionProducts.collectionId, collectionId))
    .orderBy(asc(collectionProducts.position));

  return rows.map((row) => row.productId);
}

export async function listCollectionProductsForAdmin(
  collectionId: string,
): Promise<AdminCollectionProduct[]> {
  return db
    .select({
      id: products.id,
      title: products.title,
      slug: products.slug,
      status: products.status,
      position: collectionProducts.position,
    })
    .from(collectionProducts)
    .innerJoin(products, eq(products.id, collectionProducts.productId))
    .where(eq(collectionProducts.collectionId, collectionId))
    .orderBy(asc(collectionProducts.position), asc(products.title));
}

export async function listHomeCollections(): Promise<HomeCollection[]> {
  const active = await listActiveCollections();

  const rows = await Promise.all(
    active.map(async (collection) => ({
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      description: collection.description,
      products: await listCatalogByIds(await listCollectionProductIds(collection.id)),
    })),
  );

  return rows.filter((collection) => collection.products.length > 0);
}

export type CollectionInput = {
  name: string;
  slug: string;
  description: string;
  active: boolean;
};

async function slugTaken(slug: string, exceptId?: string): Promise<boolean> {
  const [row] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.slug, slug))
    .limit(1);

  return Boolean(row && row.id !== exceptId);
}

async function nextPosition(): Promise<number> {
  const [row] = await db
    .select({ next: sql<number>`coalesce(max(${collections.position}), -1)::int + 1` })
    .from(collections);

  return row?.next ?? 0;
}

export async function createCollection(
  input: CollectionInput,
): Promise<Result<CollectionRecord>> {
  if (await slugTaken(input.slug)) return fail("That URL slug is already in use.");

  const [created] = await db
    .insert(collections)
    .values({ ...input, position: await nextPosition() })
    .returning();

  if (!created) return fail("Could not create the collection.");
  return ok(created);
}

export async function updateCollection(
  id: string,
  input: CollectionInput,
): Promise<Result<CollectionRecord>> {
  if (await slugTaken(input.slug, id)) return fail("That URL slug is already in use.");

  const [updated] = await db
    .update(collections)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(collections.id, id))
    .returning();

  if (!updated) return fail("That collection could not be found.");
  return ok(updated);
}

export async function deleteCollection(id: string): Promise<Result<{ deleted: true }>> {
  const [deleted] = await db.delete(collections).where(eq(collections.id, id)).returning();
  if (!deleted) return fail("That collection could not be found.");
  return ok({ deleted: true });
}

export async function moveCollection(id: string, direction: "up" | "down"): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(collections)
      .orderBy(asc(collections.position), asc(collections.name));

    const index = rows.findIndex((row) => row.id === id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    const current = rows[index];
    const swap = rows[swapIndex];
    if (!current || !swap) return false;

    const reordered = [...rows];
    reordered[index] = swap;
    reordered[swapIndex] = current;

    for (const [position, row] of reordered.entries()) {
      if (row.position !== position) {
        await tx
          .update(collections)
          .set({ position, updatedAt: new Date() })
          .where(eq(collections.id, row.id));
      }
    }

    return true;
  });
}

export async function addCollectionProduct(
  collectionId: string,
  productId: string,
): Promise<Result<{ productId: string }>> {
  const [collection] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);
  if (!collection) return fail("That collection could not be found.");

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) return fail("That product could not be found.");

  const [existing] = await db
    .select({ productId: collectionProducts.productId })
    .from(collectionProducts)
    .where(
      and(
        eq(collectionProducts.collectionId, collectionId),
        eq(collectionProducts.productId, productId),
      ),
    )
    .limit(1);

  if (existing) return fail("That product is already in this collection.");

  const [positionRow] = await db
    .select({
      next: sql<number>`coalesce(max(${collectionProducts.position}), -1)::int + 1`,
    })
    .from(collectionProducts)
    .where(eq(collectionProducts.collectionId, collectionId));

  await db.insert(collectionProducts).values({
    collectionId,
    productId,
    position: positionRow?.next ?? 0,
  });

  return ok({ productId });
}

export async function removeCollectionProduct(
  collectionId: string,
  productId: string,
): Promise<Result<{ removed: true }>> {
  const [deleted] = await db
    .delete(collectionProducts)
    .where(
      and(
        eq(collectionProducts.collectionId, collectionId),
        eq(collectionProducts.productId, productId),
      ),
    )
    .returning();

  if (!deleted) return fail("That product is not in this collection.");
  return ok({ removed: true });
}

export async function moveCollectionProduct(
  collectionId: string,
  productId: string,
  direction: "up" | "down",
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(collectionProducts)
      .where(eq(collectionProducts.collectionId, collectionId))
      .orderBy(asc(collectionProducts.position), asc(collectionProducts.productId));

    const index = rows.findIndex((row) => row.productId === productId);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    const current = rows[index];
    const swap = rows[swapIndex];
    if (!current || !swap) return false;

    const reordered = [...rows];
    reordered[index] = swap;
    reordered[swapIndex] = current;

    for (const [position, row] of reordered.entries()) {
      if (row.position !== position) {
        await tx
          .update(collectionProducts)
          .set({ position })
          .where(
            and(
              eq(collectionProducts.collectionId, collectionId),
              eq(collectionProducts.productId, row.productId),
            ),
          );
      }
    }

    return true;
  });
}
