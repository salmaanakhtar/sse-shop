import { asc, eq, inArray, sql } from "drizzle-orm";
import {
  buildCategoryTree,
  categoryPath,
  descendantIds,
  type CategoryNode,
  type CategoryRecord,
} from "@/lib/categories";
import { fail, ok, type Result } from "@/lib/result";
import { db } from "../db/client";
import { categories, productCategories } from "../db/schema";

export type AdminCategoryRow = CategoryRecord & { productCount: number };

const recordColumns = {
  id: categories.id,
  parentId: categories.parentId,
  name: categories.name,
  slug: categories.slug,
  description: categories.description,
  position: categories.position,
  active: categories.active,
};

export async function listAllCategories(): Promise<CategoryRecord[]> {
  return db
    .select(recordColumns)
    .from(categories)
    .orderBy(asc(categories.position), asc(categories.name));
}

export async function listAdminCategories(): Promise<AdminCategoryRow[]> {
  const [rows, counts] = await Promise.all([
    listAllCategories(),
    db
      .select({
        categoryId: productCategories.categoryId,
        productCount: sql<number>`count(*)::int`,
      })
      .from(productCategories)
      .groupBy(productCategories.categoryId),
  ]);

  const byCategory = new Map(counts.map((row) => [row.categoryId, row.productCount]));

  return rows.map((row) => ({
    ...row,
    productCount: byCategory.get(row.id) ?? 0,
  }));
}

export async function listCategoryTree(): Promise<CategoryNode[]> {
  const rows = await db
    .select(recordColumns)
    .from(categories)
    .where(eq(categories.active, true))
    .orderBy(asc(categories.position), asc(categories.name));

  return buildCategoryTree(rows);
}

export async function getCategory(id: string): Promise<CategoryRecord | null> {
  const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return row ?? null;
}

export async function getActiveCategoryPage(
  slug: string,
): Promise<{ category: CategoryNode; path: CategoryNode[] } | null> {
  const tree = await listCategoryTree();

  const find = (nodes: CategoryNode[]): CategoryNode | null => {
    for (const node of nodes) {
      if (node.slug === slug) return node;
      const found = find(node.children);
      if (found) return found;
    }
    return null;
  };

  const category = find(tree);
  if (!category) return null;
  return { category, path: categoryPath(tree, category.id) };
}

export type CategoryInput = {
  name: string;
  slug: string;
  description: string;
  parentId: string | null;
  active: boolean;
};

async function slugTaken(slug: string, exceptId?: string): Promise<boolean> {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);

  return Boolean(row && row.id !== exceptId);
}

async function validateParent(
  categoryId: string | null,
  parentId: string | null,
): Promise<string | null> {
  if (!parentId) return null;

  const rows = await listAllCategories();
  const tree = buildCategoryTree(rows);
  const parent = rows.find((row) => row.id === parentId);
  if (!parent) return "That parent category does not exist.";

  if (categoryId) {
    const find = (nodes: CategoryNode[]): CategoryNode | null => {
      for (const item of nodes) {
        if (item.id === categoryId) return item;
        const found = find(item.children);
        if (found) return found;
      }
      return null;
    };

    const node = find(tree);
    if (node && descendantIds(node).includes(parentId)) {
      return "A category cannot be moved under itself or its children.";
    }
  }

  return null;
}

async function nextPosition(parentId: string | null): Promise<number> {
  const [row] = await db
    .select({ next: sql<number>`coalesce(max(${categories.position}), -1)::int + 1` })
    .from(categories)
    .where(
      parentId
        ? eq(categories.parentId, parentId)
        : sql`${categories.parentId} is null`,
    );

  return row?.next ?? 0;
}

export async function createCategory(input: CategoryInput): Promise<Result<CategoryRecord>> {
  const parentError = await validateParent(null, input.parentId);
  if (parentError) return fail(parentError);
  if (await slugTaken(input.slug)) return fail("That URL slug is already in use.");

  const [created] = await db
    .insert(categories)
    .values({ ...input, position: await nextPosition(input.parentId) })
    .returning();

  if (!created) return fail("Could not create the category.");
  return ok(created);
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<Result<CategoryRecord>> {
  const [current] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  if (!current) return fail("That category could not be found.");

  const parentError = await validateParent(id, input.parentId);
  if (parentError) return fail(parentError);
  if (await slugTaken(input.slug, id)) return fail("That URL slug is already in use.");

  const moved = current.parentId !== input.parentId;

  const [updated] = await db
    .update(categories)
    .set({
      ...input,
      position: moved ? await nextPosition(input.parentId) : current.position,
      updatedAt: new Date(),
    })
    .where(eq(categories.id, id))
    .returning();

  if (!updated) return fail("That category could not be found.");
  return ok(updated);
}

export async function deleteCategory(id: string): Promise<Result<{ deleted: true }>> {
  const [child] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.parentId, id))
    .limit(1);

  if (child) {
    return fail("Move or delete the child categories before deleting this one.");
  }

  const [assignment] = await db
    .select({ productId: productCategories.productId })
    .from(productCategories)
    .where(eq(productCategories.categoryId, id))
    .limit(1);

  if (assignment) {
    return fail("Remove this category from its products before deleting it.");
  }

  const [deleted] = await db.delete(categories).where(eq(categories.id, id)).returning();
  if (!deleted) return fail("That category could not be found.");
  return ok({ deleted: true });
}

export async function moveCategory(id: string, direction: "up" | "down"): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [category] = await tx.select().from(categories).where(eq(categories.id, id)).limit(1);
    if (!category) return false;

    const siblings = await tx
      .select()
      .from(categories)
      .where(
        category.parentId
          ? eq(categories.parentId, category.parentId)
          : sql`${categories.parentId} is null`,
      )
      .orderBy(asc(categories.position), asc(categories.name));

    const index = siblings.findIndex((row) => row.id === id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    const current = siblings[index];
    const swap = siblings[swapIndex];
    if (!current || !swap) return false;

    const reordered = [...siblings];
    reordered[index] = swap;
    reordered[swapIndex] = current;

    for (const [position, row] of reordered.entries()) {
      if (row.position !== position) {
        await tx
          .update(categories)
          .set({ position, updatedAt: new Date() })
          .where(eq(categories.id, row.id));
      }
    }

    return true;
  });
}

export async function listProductsInCategoryTree(category: CategoryNode): Promise<string[]> {
  const ids = descendantIds(category);
  const rows = await db
    .select({ productId: productCategories.productId })
    .from(productCategories)
    .where(inArray(productCategories.categoryId, ids));

  return [...new Set(rows.map((row) => row.productId))];
}

export async function listProductCategoryIds(productId: string): Promise<string[]> {
  const rows = await db
    .select({ categoryId: productCategories.categoryId })
    .from(productCategories)
    .where(eq(productCategories.productId, productId));

  return rows.map((row) => row.categoryId);
}

export async function setProductCategories(
  productId: string,
  categoryIds: string[],
): Promise<Result<{ categoryIds: string[] }>> {
  const unique = [...new Set(categoryIds.filter(Boolean))];

  if (unique.length > 0) {
    const existing = await db
      .select({ id: categories.id })
      .from(categories)
      .where(inArray(categories.id, unique));

    if (existing.length !== unique.length) {
      return fail("One of those categories no longer exists.");
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(productCategories).where(eq(productCategories.productId, productId));
    if (unique.length > 0) {
      await tx
        .insert(productCategories)
        .values(unique.map((categoryId) => ({ productId, categoryId })));
    }
  });

  return ok({ categoryIds: unique });
}
