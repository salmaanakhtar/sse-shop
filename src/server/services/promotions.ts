import { and, asc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  buildCategoryTree,
  flattenCategoryTree,
  type CategoryRecord,
} from "@/lib/categories";
import {
  isPromotionTargetType,
  promotionStatus,
  promotionTargetPath,
  type PromotionStatus,
  type PromotionTargetType,
} from "@/lib/promotions";
import { db } from "../db/client";
import { categories, collections, products, promotions } from "../db/schema";

export type PromotionTargetSummary = {
  type: PromotionTargetType;
  id: string;
  label: string;
  href: string;
  active: boolean;
  missing: boolean;
};

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
  target: PromotionTargetSummary | null;
};

export type PromotionTargetOptions = {
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

function targetKey(type: PromotionTargetType, id: string): string {
  return `${type}:${id}`;
}

function targetSummary(
  type: PromotionTargetType,
  row: { id: string; slug: string; label: string; active: boolean },
): PromotionTargetSummary {
  return {
    type,
    id: row.id,
    label: row.label,
    href: promotionTargetPath(type, row.slug),
    active: row.active,
    missing: false,
  };
}

async function resolveTargets(
  rows: { targetType: string; targetId: string | null }[],
): Promise<Map<string, PromotionTargetSummary>> {
  const categoryIds: string[] = [];
  const collectionIds: string[] = [];
  const productIds: string[] = [];

  for (const row of rows) {
    if (!row.targetId || !isPromotionTargetType(row.targetType)) continue;
    const bucket =
      row.targetType === "category"
        ? categoryIds
        : row.targetType === "collection"
          ? collectionIds
          : productIds;
    bucket.push(row.targetId);
  }

  const [categoryRows, collectionRows, productRows] = await Promise.all([
    categoryIds.length > 0
      ? db
          .select({
            id: categories.id,
            slug: categories.slug,
            label: categories.name,
            active: categories.active,
          })
          .from(categories)
          .where(inArray(categories.id, categoryIds))
      : Promise.resolve([]),
    collectionIds.length > 0
      ? db
          .select({
            id: collections.id,
            slug: collections.slug,
            label: collections.name,
            active: collections.active,
          })
          .from(collections)
          .where(inArray(collections.id, collectionIds))
      : Promise.resolve([]),
    productIds.length > 0
      ? db
          .select({
            id: products.id,
            slug: products.slug,
            label: products.title,
            status: products.status,
          })
          .from(products)
          .where(inArray(products.id, productIds))
      : Promise.resolve([]),
  ]);

  const map = new Map<string, PromotionTargetSummary>();

  for (const row of categoryRows) {
    map.set(targetKey("category", row.id), targetSummary("category", row));
  }
  for (const row of collectionRows) {
    map.set(targetKey("collection", row.id), targetSummary("collection", row));
  }
  for (const row of productRows) {
    map.set(
      targetKey("product", row.id),
      targetSummary("product", {
        id: row.id,
        slug: row.slug,
        label: row.label,
        active: row.status === "active",
      }),
    );
  }

  return map;
}

function targetForRow(
  row: { targetType: string; targetId: string | null },
  map: Map<string, PromotionTargetSummary>,
): PromotionTargetSummary | null {
  if (!row.targetId || !isPromotionTargetType(row.targetType)) return null;

  return (
    map.get(targetKey(row.targetType, row.targetId)) ?? {
      type: row.targetType,
      id: row.targetId,
      label: "Missing destination",
      href: "",
      active: false,
      missing: true,
    }
  );
}

export async function listActivePromotions(now = new Date()): Promise<PromotionSlide[]> {
  const rows = await db
    .select()
    .from(promotions)
    .where(
      and(
        eq(promotions.active, true),
        or(isNull(promotions.startsAt), lte(promotions.startsAt, now)),
        or(isNull(promotions.endsAt), gt(promotions.endsAt, now)),
      ),
    )
    .orderBy(asc(promotions.position), asc(promotions.createdAt));

  const targets = await resolveTargets(rows);

  return rows.flatMap((row) => {
    const target = targetForRow(row, targets);
    if (!target || target.missing || !target.active) return [];

    return [
      {
        id: row.id,
        headline: row.headline,
        subheadline: row.subheadline,
        ctaLabel: row.ctaLabel,
        href: target.href,
        imageKey: row.imageKey,
        imageAlt: row.imageAlt,
      },
    ];
  });
}

export async function listAdminPromotions(): Promise<AdminPromotion[]> {
  const rows = await db
    .select()
    .from(promotions)
    .orderBy(asc(promotions.position), asc(promotions.createdAt));

  const targets = await resolveTargets(rows);
  const now = new Date();

  return rows.map((row) => ({
    ...row,
    status: promotionStatus(row, now),
    target: targetForRow(row, targets),
  }));
}

export async function getPromotion(id: string): Promise<AdminPromotion | null> {
  const [row] = await db.select().from(promotions).where(eq(promotions.id, id)).limit(1);
  if (!row) return null;

  const targets = await resolveTargets([row]);
  return {
    ...row,
    status: promotionStatus(row),
    target: targetForRow(row, targets),
  };
}

export async function listPromotionTargets(): Promise<PromotionTargetOptions> {
  const [categoryRows, collectionRows, productRows] = await Promise.all([
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

  const flatCategories = flattenCategoryTree(
    buildCategoryTree(categoryRows as CategoryRecord[]),
  );

  return {
    categories: flatCategories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      active: category.active,
      depth: category.depth,
    })),
    collections: collectionRows.map((collection) => ({
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      active: collection.active,
    })),
    products: productRows,
  };
}

export async function getPromotionTarget(
  type: string,
  id: string,
): Promise<PromotionTargetSummary | null> {
  if (!isPromotionTargetType(type)) return null;

  if (type === "category") {
    const [row] = await db
      .select({
        id: categories.id,
        slug: categories.slug,
        label: categories.name,
        active: categories.active,
      })
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);
    return row ? targetSummary("category", row) : null;
  }

  if (type === "collection") {
    const [row] = await db
      .select({
        id: collections.id,
        slug: collections.slug,
        label: collections.name,
        active: collections.active,
      })
      .from(collections)
      .where(eq(collections.id, id))
      .limit(1);
    return row ? targetSummary("collection", row) : null;
  }

  const [row] = await db
    .select({
      id: products.id,
      slug: products.slug,
      label: products.title,
      status: products.status,
    })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  return row
    ? targetSummary("product", {
        id: row.id,
        slug: row.slug,
        label: row.label,
        active: row.status === "active",
      })
    : null;
}

export type PromotionInput = {
  headline: string;
  subheadline: string;
  ctaLabel: string;
  targetType: PromotionTargetType;
  targetId: string;
  imageKey: string;
  imageAlt: string;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

export async function createPromotion(input: PromotionInput): Promise<AdminPromotion> {
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
    target: await getPromotionTarget(created.targetType, created.targetId ?? ""),
  };
}

export async function updatePromotion(
  id: string,
  input: Omit<PromotionInput, "imageKey">,
): Promise<AdminPromotion | null> {
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
    target: await getPromotionTarget(updated.targetType, updated.targetId ?? ""),
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
    target: await getPromotionTarget(updated.targetType, updated.targetId ?? ""),
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
