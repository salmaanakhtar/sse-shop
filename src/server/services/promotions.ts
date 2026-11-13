import { and, asc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  buildCategoryTree,
  findCategoryById,
  flattenCategoryTree,
} from "@/lib/categories";
import {
  isPromotionRowKind,
  promotionPagePath,
  promotionStatus,
  type PromotionRowKind,
  type PromotionStatus,
} from "@/lib/promotions";
import { fail, ok, type Result } from "@/lib/result";
import { db } from "../db/client";
import {
  categories,
  collections,
  products,
  promotionRowProducts,
  promotionRows,
  promotions,
} from "../db/schema";
import { listCatalog, type CatalogCard } from "./catalog";
import {
  listCategoryTree,
  listProductsInCategoryTree,
} from "./categories";
import { getCollection, listCollectionProductIds } from "./collections";

export type PromotionSlide = {
  id: string;
  headline: string;
  subheadline: string;
  ctaLabel: string;
  href: string;
  imageKey: string;
  imageAlt: string;
};

export type AdminPromotion = typeof promotions.$inferSelect & {
  status: PromotionStatus;
  href: string;
};

export type PromotionRowOptions = {
  categories: {
    id: string;
    name: string;
    slug: string;
    active: boolean;
    depth: number;
  }[];
  collections: {
    id: string;
    name: string;
    slug: string;
    active: boolean;
  }[];
  products: {
    id: string;
    title: string;
    slug: string;
    status: "draft" | "active" | "archived";
  }[];
};

export type AdminPromotionRowProduct = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "active" | "archived";
  position: number;
};

export type AdminPromotionRow = {
  id: string;
  kind: PromotionRowKind;
  title: string;
  position: number;
  categoryId: string | null;
  collectionId: string | null;
  sourceLabel: string;
  products: AdminPromotionRowProduct[];
};

export type PromotionPageRow = {
  id: string;
  kind: PromotionRowKind;
  title: string;
  products: CatalogCard[];
};

export type PromotionPage = {
  promotion: typeof promotions.$inferSelect;
  rows: PromotionPageRow[];
};

function liveConditions(now: Date) {
  return and(
    eq(promotions.active, true),
    or(isNull(promotions.startsAt), lte(promotions.startsAt, now)),
    or(isNull(promotions.endsAt), gt(promotions.endsAt, now)),
  );
}

export async function listActivePromotions(now = new Date()): Promise<PromotionSlide[]> {
  const rows = await db
    .select()
    .from(promotions)
    .where(liveConditions(now))
    .orderBy(asc(promotions.position), asc(promotions.createdAt));

  return rows.map((row) => ({
    id: row.id,
    headline: row.headline,
    subheadline: row.subheadline,
    ctaLabel: row.ctaLabel,
    href: promotionPagePath(row.slug),
    imageKey: row.imageKey,
    imageAlt: row.imageAlt,
  }));
}

export async function listAdminPromotions(): Promise<AdminPromotion[]> {
  const rows = await db
    .select()
    .from(promotions)
    .orderBy(asc(promotions.position), asc(promotions.createdAt));

  const now = new Date();
  return rows.map((row) => ({
    ...row,
    status: promotionStatus(row, now),
    href: promotionPagePath(row.slug),
  }));
}

export async function getPromotion(id: string): Promise<AdminPromotion | null> {
  const [row] = await db.select().from(promotions).where(eq(promotions.id, id)).limit(1);
  if (!row) return null;

  return {
    ...row,
    status: promotionStatus(row),
    href: promotionPagePath(row.slug),
  };
}

export async function getActivePromotionPage(
  slug: string,
  now = new Date(),
): Promise<PromotionPage | null> {
  const [promotion] = await db
    .select()
    .from(promotions)
    .where(and(eq(promotions.slug, slug), liveConditions(now)))
    .limit(1);
  if (!promotion) return null;

  const [rows, catalog, categoryTree] = await Promise.all([
    db
      .select()
      .from(promotionRows)
      .where(eq(promotionRows.promotionId, promotion.id))
      .orderBy(asc(promotionRows.position), asc(promotionRows.createdAt)),
    listCatalog(),
    listCategoryTree(),
  ]);

  if (rows.length === 0) return { promotion, rows: [] };

  const rowIds = rows.map((row) => row.id);
  const productRows = await db
    .select({ rowId: promotionRowProducts.rowId, productId: promotionRowProducts.productId })
    .from(promotionRowProducts)
    .where(inArray(promotionRowProducts.rowId, rowIds))
    .orderBy(asc(promotionRowProducts.position));

  const productIdsByRow = new Map<string, string[]>();
  for (const row of productRows) {
    const ids = productIdsByRow.get(row.rowId) ?? [];
    ids.push(row.productId);
    productIdsByRow.set(row.rowId, ids);
  }

  const byId = new Map(catalog.map((product) => [product.id, product]));
  const pageRows: PromotionPageRow[] = [];

  for (const row of rows) {
    if (!isPromotionRowKind(row.kind)) continue;

    let productsForRow: CatalogCard[] = [];

    if (row.kind === "category" && row.categoryId) {
      const category = findCategoryById(categoryTree, row.categoryId);
      if (!category) continue;
      const ids = new Set(await listProductsInCategoryTree(category));
      productsForRow = catalog.filter((product) => ids.has(product.id));
    }

    if (row.kind === "collection" && row.collectionId) {
      const collection = await getCollection(row.collectionId);
      if (!collection || !collection.active) continue;
      const ids = await listCollectionProductIds(row.collectionId);
      productsForRow = ids
        .map((id) => byId.get(id))
        .filter((product): product is CatalogCard => Boolean(product));
    }

    if (row.kind === "products") {
      productsForRow = (productIdsByRow.get(row.id) ?? [])
        .map((id) => byId.get(id))
        .filter((product): product is CatalogCard => Boolean(product));
    }

    if (productsForRow.length === 0) continue;

    pageRows.push({
      id: row.id,
      kind: row.kind,
      title: row.title,
      products: productsForRow,
    });
  }

  return { promotion, rows: pageRows };
}

export async function listPromotionRowOptions(): Promise<PromotionRowOptions> {
  const [allCategories, allCollections, productRows] = await Promise.all([
    db
      .select()
      .from(categories)
      .orderBy(asc(categories.position), asc(categories.name)),
    db
      .select()
      .from(collections)
      .orderBy(asc(collections.position), asc(collections.name)),
    db
      .select({
        id: products.id,
        title: products.title,
        slug: products.slug,
        status: products.status,
      })
      .from(products)
      .orderBy(asc(products.title)),
  ]);

  const categoryOptions = flattenCategoryTree(buildCategoryTree(allCategories));

  return {
    categories: categoryOptions.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      active: category.active,
      depth: category.depth,
    })),
    collections: allCollections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      active: collection.active,
    })),
    products: productRows,
  };
}

export async function listPromotionRows(promotionId: string): Promise<AdminPromotionRow[]> {
  const rows = await db
    .select()
    .from(promotionRows)
    .where(eq(promotionRows.promotionId, promotionId))
    .orderBy(asc(promotionRows.position), asc(promotionRows.createdAt));

  if (rows.length === 0) return [];

  const categoryIds = rows
    .map((row) => row.categoryId)
    .filter((id): id is string => Boolean(id));
  const collectionIds = rows
    .map((row) => row.collectionId)
    .filter((id): id is string => Boolean(id));
  const rowIds = rows.map((row) => row.id);

  const [categoryRows, collectionRows, productRows] = await Promise.all([
    categoryIds.length > 0
      ? db
          .select({ id: categories.id, name: categories.name })
          .from(categories)
          .where(inArray(categories.id, categoryIds))
      : Promise.resolve([]),
    collectionIds.length > 0
      ? db
          .select({ id: collections.id, name: collections.name })
          .from(collections)
          .where(inArray(collections.id, collectionIds))
      : Promise.resolve([]),
    db
      .select({
        rowId: promotionRowProducts.rowId,
        id: products.id,
        title: products.title,
        slug: products.slug,
        status: products.status,
        position: promotionRowProducts.position,
      })
      .from(promotionRowProducts)
      .innerJoin(products, eq(products.id, promotionRowProducts.productId))
      .where(inArray(promotionRowProducts.rowId, rowIds))
      .orderBy(asc(promotionRowProducts.position)),
  ]);

  const categoryNames = new Map(categoryRows.map((row) => [row.id, row.name]));
  const collectionNames = new Map(collectionRows.map((row) => [row.id, row.name]));
  const productsByRow = new Map<string, AdminPromotionRowProduct[]>();

  for (const product of productRows) {
    const list = productsByRow.get(product.rowId) ?? [];
    list.push({
      id: product.id,
      title: product.title,
      slug: product.slug,
      status: product.status,
      position: product.position,
    });
    productsByRow.set(product.rowId, list);
  }

  return rows.map((row) => {
    const kind = isPromotionRowKind(row.kind) ? row.kind : "products";
    const sourceLabel =
      kind === "category"
        ? (row.categoryId ? categoryNames.get(row.categoryId) : undefined) ?? "Missing category"
        : kind === "collection"
          ? (row.collectionId
              ? collectionNames.get(row.collectionId)
              : undefined) ?? "Missing collection"
          : `${productsByRow.get(row.id)?.length ?? 0} products`;

    return {
      id: row.id,
      kind,
      title: row.title,
      position: row.position,
      categoryId: row.categoryId,
      collectionId: row.collectionId,
      sourceLabel,
      products: productsByRow.get(row.id) ?? [],
    };
  });
}

export type PromotionInput = {
  slug: string;
  headline: string;
  subheadline: string;
  ctaLabel: string;
  imageKey: string;
  imageAlt: string;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

async function slugTaken(slug: string, exceptId?: string): Promise<boolean> {
  const [row] = await db
    .select({ id: promotions.id })
    .from(promotions)
    .where(eq(promotions.slug, slug))
    .limit(1);

  return Boolean(row && row.id !== exceptId);
}

export async function createPromotion(input: PromotionInput): Promise<AdminPromotion> {
  if (await slugTaken(input.slug)) {
    throw new Error("That promotion URL is already in use.");
  }

  const [positionRow] = await db
    .select({ next: sql<number>`coalesce(max(${promotions.position}), -1)::int + 1` })
    .from(promotions);

  const [created] = await db
    .insert(promotions)
    .values({
      ...input,
      position: positionRow?.next ?? 0,
    })
    .returning();

  if (!created) throw new Error("Could not create the promotion.");

  return {
    ...created,
    status: promotionStatus(created),
    href: promotionPagePath(created.slug),
  };
}

export async function updatePromotion(
  id: string,
  input: Omit<PromotionInput, "imageKey">,
): Promise<AdminPromotion | null> {
  if (await slugTaken(input.slug, id)) {
    throw new Error("That promotion URL is already in use.");
  }

  const [updated] = await db
    .update(promotions)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(promotions.id, id))
    .returning();

  if (!updated) return null;
  return {
    ...updated,
    status: promotionStatus(updated),
    href: promotionPagePath(updated.slug),
  };
}

export async function replacePromotionImage(
  id: string,
  imageKey: string,
  imageAlt: string,
): Promise<AdminPromotion | null> {
  const [updated] = await db
    .update(promotions)
    .set({ imageKey, imageAlt, updatedAt: new Date() })
    .where(eq(promotions.id, id))
    .returning();

  if (!updated) return null;
  return {
    ...updated,
    status: promotionStatus(updated),
    href: promotionPagePath(updated.slug),
  };
}

export async function deletePromotion(id: string): Promise<typeof promotions.$inferSelect | null> {
  const [deleted] = await db.delete(promotions).where(eq(promotions.id, id)).returning();
  return deleted ?? null;
}

export async function movePromotion(
  id: string,
  direction: "up" | "down",
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(promotions)
      .orderBy(asc(promotions.position), asc(promotions.createdAt));

    const index = rows.findIndex((row) => row.id === id);
    if (index === -1) return false;

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
          .update(promotions)
          .set({ position, updatedAt: new Date() })
          .where(eq(promotions.id, row.id));
      }
    }

    return true;
  });
}

export type PromotionRowInput =
  | { kind: "category"; categoryId: string; title: string }
  | { kind: "collection"; collectionId: string; title: string }
  | { kind: "products"; productIds: string[]; title: string };

export async function addPromotionRow(
  promotionId: string,
  input: PromotionRowInput,
): Promise<Result<{ id: string }>> {
  const [promotion] = await db
    .select({ id: promotions.id })
    .from(promotions)
    .where(eq(promotions.id, promotionId))
    .limit(1);
  if (!promotion) return fail("That promotion could not be found.");

  let title = input.title.trim();
  let categoryId: string | null = null;
  let collectionId: string | null = null;
  let productIds: string[] = [];

  if (input.kind === "category") {
    const [category] = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.id, input.categoryId))
      .limit(1);
    if (!category) return fail("That category could not be found.");

    const [duplicate] = await db
      .select({ id: promotionRows.id })
      .from(promotionRows)
      .where(
        and(
          eq(promotionRows.promotionId, promotionId),
          eq(promotionRows.kind, "category"),
          eq(promotionRows.categoryId, category.id),
        ),
      )
      .limit(1);
    if (duplicate) return fail("That category is already a row on this page.");

    categoryId = category.id;
    title = title || category.name;
  }

  if (input.kind === "collection") {
    const [collection] = await db
      .select({ id: collections.id, name: collections.name })
      .from(collections)
      .where(eq(collections.id, input.collectionId))
      .limit(1);
    if (!collection) return fail("That collection could not be found.");

    const [duplicate] = await db
      .select({ id: promotionRows.id })
      .from(promotionRows)
      .where(
        and(
          eq(promotionRows.promotionId, promotionId),
          eq(promotionRows.kind, "collection"),
          eq(promotionRows.collectionId, collection.id),
        ),
      )
      .limit(1);
    if (duplicate) return fail("That collection is already a row on this page.");

    collectionId = collection.id;
    title = title || collection.name;
  }

  if (input.kind === "products") {
    productIds = [...new Set(input.productIds.filter(Boolean))];
    if (productIds.length === 0) return fail("Choose at least one product.");
    if (!title) return fail("Give the product row a heading.");

    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(inArray(products.id, productIds));
    if (existing.length !== productIds.length) {
      return fail("One of those products no longer exists.");
    }
  }

  if (title.length > 80) return fail("Keep the row heading under 80 characters.");

  const [positionRow] = await db
    .select({ next: sql<number>`coalesce(max(${promotionRows.position}), -1)::int + 1` })
    .from(promotionRows)
    .where(eq(promotionRows.promotionId, promotionId));

  const [created] = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(promotionRows)
      .values({
        promotionId,
        kind: input.kind,
        title,
        categoryId,
        collectionId,
        position: positionRow?.next ?? 0,
      })
      .returning({ id: promotionRows.id });

    if (!row) return [];

    if (productIds.length > 0) {
      await tx.insert(promotionRowProducts).values(
        productIds.map((productId, position) => ({
          rowId: row.id,
          productId,
          position,
        })),
      );
    }

    return [row];
  });

  if (!created) return fail("Could not add the row.");
  return ok({ id: created.id });
}

export async function getPromotionRow(
  rowId: string,
): Promise<typeof promotionRows.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(promotionRows)
    .where(eq(promotionRows.id, rowId))
    .limit(1);
  return row ?? null;
}

export async function updatePromotionRowTitle(
  rowId: string,
  inputTitle: string,
): Promise<Result<{ title: string }>> {
  const title = inputTitle.trim();
  if (!title) return fail("Give the row a heading.");
  if (title.length > 80) return fail("Keep the row heading under 80 characters.");

  const [updated] = await db
    .update(promotionRows)
    .set({ title, updatedAt: new Date() })
    .where(eq(promotionRows.id, rowId))
    .returning({ title: promotionRows.title });

  if (!updated) return fail("That row could not be found.");
  return ok(updated);
}

export async function deletePromotionRow(
  rowId: string,
): Promise<Result<{ deleted: true }>> {
  const [deleted] = await db
    .delete(promotionRows)
    .where(eq(promotionRows.id, rowId))
    .returning();
  if (!deleted) return fail("That row could not be found.");
  return ok({ deleted: true });
}

export async function movePromotionRow(
  rowId: string,
  direction: "up" | "down",
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(promotionRows)
      .where(eq(promotionRows.id, rowId))
      .limit(1);
    if (!row) return false;

    const siblings = await tx
      .select()
      .from(promotionRows)
      .where(eq(promotionRows.promotionId, row.promotionId))
      .orderBy(asc(promotionRows.position), asc(promotionRows.createdAt));

    const index = siblings.findIndex((item) => item.id === rowId);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    const current = siblings[index];
    const swap = siblings[swapIndex];
    if (!current || !swap) return false;

    const reordered = [...siblings];
    reordered[index] = swap;
    reordered[swapIndex] = current;

    for (const [position, item] of reordered.entries()) {
      if (item.position !== position) {
        await tx
          .update(promotionRows)
          .set({ position, updatedAt: new Date() })
          .where(eq(promotionRows.id, item.id));
      }
    }

    return true;
  });
}

export async function addPromotionRowProducts(
  rowId: string,
  productIds: string[],
): Promise<Result<{ added: number }>> {
  const row = await getPromotionRow(rowId);
  if (!row) return fail("That row could not be found.");
  if (row.kind !== "products") return fail("Only a product row can take products.");

  const unique = [...new Set(productIds.filter(Boolean))];
  if (unique.length === 0) return fail("Choose at least one product.");

  const existingProducts = await db
    .select({ id: products.id })
    .from(products)
    .where(inArray(products.id, unique));
  if (existingProducts.length !== unique.length) {
    return fail("One of those products no longer exists.");
  }

  const current = await db
    .select({ productId: promotionRowProducts.productId })
    .from(promotionRowProducts)
    .where(eq(promotionRowProducts.rowId, rowId));
  const currentIds = new Set(current.map((item) => item.productId));
  const added = unique.filter((id) => !currentIds.has(id));
  if (added.length === 0) return fail("Those products are already in this row.");

  const [positionRow] = await db
    .select({
      next: sql<number>`coalesce(max(${promotionRowProducts.position}), -1)::int + 1`,
    })
    .from(promotionRowProducts)
    .where(eq(promotionRowProducts.rowId, rowId));

  await db.insert(promotionRowProducts).values(
    added.map((productId, index) => ({
      rowId,
      productId,
      position: (positionRow?.next ?? 0) + index,
    })),
  );

  return ok({ added: added.length });
}

export async function removePromotionRowProduct(
  rowId: string,
  productId: string,
): Promise<Result<{ removed: true }>> {
  const [deleted] = await db
    .delete(promotionRowProducts)
    .where(
      and(
        eq(promotionRowProducts.rowId, rowId),
        eq(promotionRowProducts.productId, productId),
      ),
    )
    .returning();

  if (!deleted) return fail("That product is not in this row.");
  return ok({ removed: true });
}
