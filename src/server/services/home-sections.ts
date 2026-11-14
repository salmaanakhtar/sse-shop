import { asc, eq, sql } from "drizzle-orm";
import { findCategoryById } from "@/lib/categories";
import { fail, ok, type Result } from "@/lib/result";
import { db } from "../db/client";
import { homeSections } from "../db/schema";
import { listCatalog, listCatalogByIds, type CatalogCard } from "./catalog";
import {
  getCollection,
  listCollectionProductIds,
} from "./collections";
import { listCategoryTree, listProductsInCategoryTree } from "./categories";
import { listActivePromotions, type PromotionSlide } from "./promotions";

export const HOME_SECTION_KINDS = [
  "hero",
  "promotions",
  "collection",
  "category",
  "text",
  "products",
  "allProducts",
] as const;

export type HomeSectionKind = (typeof HOME_SECTION_KINDS)[number];

export function isHomeSectionKind(value: string): value is HomeSectionKind {
  return (HOME_SECTION_KINDS as readonly string[]).includes(value);
}

export type HomeSectionRecord = typeof homeSections.$inferSelect;

export type HomeSectionView = {
  id: string;
  kind: HomeSectionKind;
  title: string;
  body: string;
  products: CatalogCard[];
  promotions: PromotionSlide[];
  collectionSlug: string | null;
};

export type HomeSectionInput = {
  kind: HomeSectionKind;
  title: string;
  body: string;
  config: Record<string, unknown>;
  active: boolean;
};

function configString(config: unknown, key: string): string {
  if (!config || typeof config !== "object") return "";
  const value = (config as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function configLimit(config: unknown): number {
  if (!config || typeof config !== "object") return 8;
  const value = (config as Record<string, unknown>).limit;
  if (typeof value !== "number" || !Number.isInteger(value)) return 8;
  return Math.min(24, Math.max(1, value));
}

function configProductIds(config: unknown): string[] {
  if (!config || typeof config !== "object") return [];
  const value = (config as Record<string, unknown>).productIds;
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export async function listHomeSections(activeOnly = false): Promise<HomeSectionRecord[]> {
  const query = db.select().from(homeSections);
  const rows = activeOnly
    ? await query
        .where(eq(homeSections.active, true))
        .orderBy(asc(homeSections.position), asc(homeSections.createdAt))
    : await query.orderBy(asc(homeSections.position), asc(homeSections.createdAt));
  return rows;
}

export async function loadHomeSections(): Promise<HomeSectionView[]> {
  const sections = await listHomeSections(true);
  if (sections.length === 0) return [];

  const [catalog, promotions, categoryTree] = await Promise.all([
    listCatalog(),
    listActivePromotions(),
    listCategoryTree(),
  ]);
  const catalogById = new Map(catalog.map((product) => [product.id, product]));

  const views: HomeSectionView[] = [];

  for (const section of sections) {
    if (!isHomeSectionKind(section.kind)) continue;

    if (section.kind === "hero" || section.kind === "text") {
      views.push({
        id: section.id,
        kind: section.kind,
        title: section.title,
        body: section.body,
        products: [],
        promotions: [],
        collectionSlug: null,
      });
      continue;
    }

    if (section.kind === "promotions") {
      if (promotions.length > 0) {
        views.push({
          id: section.id,
          kind: section.kind,
          title: section.title,
          body: section.body,
          products: [],
          promotions,
          collectionSlug: null,
        });
      }
      continue;
    }

    if (section.kind === "allProducts") {
      views.push({
        id: section.id,
        kind: section.kind,
        title: section.title || "All products",
        body: section.body,
        products: catalog.slice(0, configLimit(section.config)),
        promotions: [],
        collectionSlug: null,
      });
      continue;
    }

    if (section.kind === "collection") {
      const collectionId = configString(section.config, "collectionId");
      const collection = collectionId ? await getCollection(collectionId) : null;
      if (!collection || !collection.active) continue;
      const ids = await listCollectionProductIds(collection.id);
      const products = ids
        .map((id) => catalogById.get(id))
        .filter((product): product is CatalogCard => Boolean(product))
        .slice(0, configLimit(section.config));
      if (products.length > 0) {
        views.push({
          id: section.id,
          kind: section.kind,
          title: section.title || collection.name,
          body: section.body || collection.description,
          products,
          promotions: [],
          collectionSlug: collection.slug,
        });
      }
      continue;
    }

    if (section.kind === "category") {
      const categoryId = configString(section.config, "categoryId");
      const category = categoryId ? findCategoryById(categoryTree, categoryId) : null;
      if (!category) continue;
      const ids = new Set(await listProductsInCategoryTree(category));
      const products = catalog
        .filter((product) => ids.has(product.id))
        .slice(0, configLimit(section.config));
      if (products.length > 0) {
        views.push({
          id: section.id,
          kind: section.kind,
          title: section.title || category.name,
          body: section.body || category.description,
          products,
          promotions: [],
          collectionSlug: null,
        });
      }
      continue;
    }

    if (section.kind === "products") {
      const products = await listCatalogByIds(configProductIds(section.config));
      if (products.length > 0) {
        views.push({
          id: section.id,
          kind: section.kind,
          title: section.title,
          body: section.body,
          products,
          promotions: [],
          collectionSlug: null,
        });
      }
    }
  }

  return views;
}

export async function getHomeSection(id: string): Promise<HomeSectionRecord | null> {
  const [row] = await db.select().from(homeSections).where(eq(homeSections.id, id)).limit(1);
  return row ?? null;
}

export async function createHomeSection(
  input: HomeSectionInput,
): Promise<Result<{ id: string }>> {
  const validation = await validateSection(input);
  if (!validation.ok) return fail(validation.error);

  const [positionRow] = await db
    .select({ next: sql<number>`coalesce(max(${homeSections.position}), -1)::int + 1` })
    .from(homeSections);

  const [created] = await db
    .insert(homeSections)
    .values({
      kind: input.kind,
      title: input.title,
      body: input.body,
      config: input.config,
      active: input.active,
      position: positionRow?.next ?? 0,
    })
    .returning({ id: homeSections.id });

  if (!created) return fail("Could not create the section.");
  return ok(created);
}

export async function updateHomeSection(
  id: string,
  input: HomeSectionInput,
): Promise<Result<{ id: string }>> {
  const validation = await validateSection(input);
  if (!validation.ok) return fail(validation.error);

  const [updated] = await db
    .update(homeSections)
    .set({
      kind: input.kind,
      title: input.title,
      body: input.body,
      config: input.config,
      active: input.active,
      updatedAt: new Date(),
    })
    .where(eq(homeSections.id, id))
    .returning({ id: homeSections.id });

  if (!updated) return fail("That section could not be found.");
  return ok(updated);
}

export async function deleteHomeSection(id: string): Promise<Result<{ deleted: true }>> {
  const [deleted] = await db
    .delete(homeSections)
    .where(eq(homeSections.id, id))
    .returning({ id: homeSections.id });
  if (!deleted) return fail("That section could not be found.");
  return ok({ deleted: true });
}

export async function moveHomeSection(
  id: string,
  direction: "up" | "down",
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(homeSections)
      .orderBy(asc(homeSections.position), asc(homeSections.createdAt));

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
          .update(homeSections)
          .set({ position, updatedAt: new Date() })
          .where(eq(homeSections.id, row.id));
      }
    }

    return true;
  });
}

async function validateSection(input: HomeSectionInput): Promise<Result<true>> {
  if (!isHomeSectionKind(input.kind)) return fail("Choose a valid section type.");
  if (input.title.length > 120) return fail("Keep the title under 120 characters.");
  if (input.body.length > 2_000) return fail("Keep the body under 2,000 characters.");

  if (input.kind === "collection") {
    const id = configString(input.config, "collectionId");
    if (!id) return fail("Choose a collection.");
    const collection = await getCollection(id);
    if (!collection) return fail("That collection no longer exists.");
  }

  if (input.kind === "category") {
    const id = configString(input.config, "categoryId");
    if (!id) return fail("Choose a category.");
    const category = findCategoryById(await listCategoryTree(), id);
    if (!category) return fail("That category no longer exists.");
  }

  if (input.kind === "products" && configProductIds(input.config).length === 0) {
    return fail("Choose at least one product.");
  }

  return ok(true);
}
