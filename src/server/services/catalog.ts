import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { activeSalePrice, discountPercent, effectivePriceMinor } from "@/lib/sale";
import { db } from "../db/client";
import {
  productMedia,
  productOptionValues,
  productOptions,
  products,
  variants,
} from "../db/schema";
import { badgesForProducts } from "./badges";
import { listVariantNodes, type VariantNodeView } from "./variant-tree";

export type CatalogBadge = {
  id: string;
  label: string;
  tone: string;
};

export type CatalogCard = {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceFromMinor: number;
  compareAtFromMinor: number | null;
  onSale: boolean;
  inStock: boolean;
  imageKey: string | null;
  imageAlt: string;
  badges: CatalogBadge[];
};

export type ProductOptionView = {
  id: string;
  name: string;
  values: { id: string; value: string }[];
};

export type ProductMediaView = {
  storageKey: string;
  alt: string;
  width: number | null;
  height: number | null;
};

export type ProductDetail = {
  id: string;
  slug: string;
  title: string;
  description: string;
  options: ProductOptionView[];
  nodes: VariantNodeView[];
  media: ProductMediaView[];
  priceFromMinor: number;
  inStock: boolean;
  badges: CatalogBadge[];
};

function firstBy<T>(rows: T[], key: (row: T) => string): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    const k = key(row);
    if (!map.has(k)) map.set(k, row);
  }
  return map;
}

async function catalogCardsForProducts(
  productRows: (typeof products.$inferSelect)[],
  now = new Date(),
): Promise<CatalogCard[]> {
  if (productRows.length === 0) return [];

  const ids = productRows.map((row) => row.id);

  const [variantRows, mediaRows, badgeMap] = await Promise.all([
    db
      .select()
      .from(variants)
      .where(and(inArray(variants.productId, ids), eq(variants.active, true))),
    db
      .select()
      .from(productMedia)
      .where(inArray(productMedia.productId, ids))
      .orderBy(asc(productMedia.position)),
    badgesForProducts(ids),
  ]);

  const firstImage = firstBy(mediaRows, (row) => row.productId);

  return productRows.map((product) => {
    const own = variantRows.filter((variant) => variant.productId === product.id);
    const media = firstImage.get(product.id);
    const priced = own.map((variant) => ({
      regular: variant.priceMinor,
      effective: effectivePriceMinor(variant.priceMinor, variant, now),
    }));
    const cheapest = priced.reduce<(typeof priced)[number] | null>(
      (best, current) => (!best || current.effective < best.effective ? current : best),
      null,
    );

    return {
      id: product.id,
      slug: product.slug,
      title: product.title,
      description: product.description,
      priceFromMinor: cheapest?.effective ?? 0,
      compareAtFromMinor:
        cheapest && cheapest.effective < cheapest.regular ? cheapest.regular : null,
      onSale: priced.some((item) => item.effective < item.regular),
      inStock: own.some((variant) => variant.stockQty > 0),
      imageKey: media?.storageKey ?? null,
      imageAlt: media?.alt ?? product.title,
      badges: (badgeMap.get(product.id) ?? []).map((badge) => ({
        id: badge.id,
        label: badge.label,
        tone: badge.tone,
      })),
    };
  });
}

export async function listCatalog(): Promise<CatalogCard[]> {
  const productRows = await db
    .select()
    .from(products)
    .where(eq(products.status, "active"))
    .orderBy(desc(products.publishedAt), asc(products.title));

  return catalogCardsForProducts(productRows);
}

/** Catalog cards for a known set of ids, keeping the caller's order. */
export async function listCatalogByIds(ids: string[]): Promise<CatalogCard[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];

  const productRows = await db
    .select()
    .from(products)
    .where(and(inArray(products.id, unique), eq(products.status, "active")));

  const cards = await catalogCardsForProducts(productRows);
  const byId = new Map(cards.map((card) => [card.id, card]));

  return unique
    .map((id) => byId.get(id))
    .filter((card): card is CatalogCard => Boolean(card));
}

export async function getProductDetail(slug: string): Promise<ProductDetail | null> {
  const [product] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  if (!product || product.status !== "active") return null;

  const [optionRows, variantRows, mediaRows, badgeMap] = await Promise.all([
    db
      .select()
      .from(productOptions)
      .where(eq(productOptions.productId, product.id))
      .orderBy(asc(productOptions.position)),
    db
      .select()
      .from(variants)
      .where(and(eq(variants.productId, product.id), eq(variants.active, true)))
      .orderBy(asc(variants.position)),
    db
      .select()
      .from(productMedia)
      .where(eq(productMedia.productId, product.id))
      .orderBy(asc(productMedia.position)),
    badgesForProducts([product.id]),
  ]);

  const optionIds = optionRows.map((option) => option.id);
  const [valueRows, nodes] = await Promise.all([
    optionIds.length > 0
      ? db
          .select()
          .from(productOptionValues)
          .where(inArray(productOptionValues.optionId, optionIds))
          .orderBy(asc(productOptionValues.position))
      : Promise.resolve([]),
    listVariantNodes(product.id),
  ]);

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    options: optionRows.map((option) => ({
      id: option.id,
      name: option.name,
      values: valueRows
        .filter((value) => value.optionId === option.id)
        .map((value) => ({ id: value.id, value: value.value })),
    })),
    nodes,
    media: mediaRows.map((row) => ({
      storageKey: row.storageKey,
      alt: row.alt,
      width: row.width,
      height: row.height,
    })),
    priceFromMinor:
      variantRows.length > 0
        ? Math.min(
            ...variantRows.map((variant) =>
              effectivePriceMinor(variant.priceMinor, variant, new Date()),
            ),
          )
        : 0,
    inStock: variantRows.some((variant) => variant.stockQty > 0),
    badges: (badgeMap.get(product.id) ?? []).map((badge) => ({
      id: badge.id,
      label: badge.label,
      tone: badge.tone,
    })),
  };
}

/** Slugs are user-facing and permanent enough that duplicate handling matters. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/* ───────────────────────── admin queries ───────────────────────── */

export type AdminProductRow = {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "active" | "archived";
  variantCount: number;
  priceFromMinor: number;
  inStock: number;
  saleStatus: "active" | "scheduled" | null;
  saleDiscountPercent: number | null;
  activeSaleVariantCount: number;
};

export type AdminProductDetail = {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: "draft" | "active" | "archived";
  options: ProductOptionView[];
  nodes: VariantNodeView[];
  media: { id: string; storageKey: string; alt: string }[];
};

export async function listAdminProducts(): Promise<AdminProductRow[]> {
  const rows = await db.select().from(products).orderBy(desc(products.updatedAt));
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const variantRows = await db.select().from(variants).where(inArray(variants.productId, ids));
  const now = new Date();

  return rows.map((product) => {
    const own = variantRows.filter((variant) => variant.productId === product.id);
    let activeSaleVariantCount = 0;
    let saleDiscountPercent: number | null = null;
    let hasScheduledSale = false;

    for (const variant of own) {
      const sale = activeSalePrice(variant.priceMinor, variant, now);
      if (sale !== null) {
        activeSaleVariantCount += 1;
        const percent = discountPercent(variant.priceMinor, sale);
        if (saleDiscountPercent === null || percent > saleDiscountPercent) {
          saleDiscountPercent = percent;
        }
        continue;
      }

      if (variant.salePriceMinor === null || variant.salePriceMinor >= variant.priceMinor) {
        continue;
      }

      const startsAt = variant.saleStartsAt ? new Date(variant.saleStartsAt).getTime() : null;
      const endsAt = variant.saleEndsAt ? new Date(variant.saleEndsAt).getTime() : null;
      if (startsAt !== null && startsAt > now.getTime() && (endsAt === null || endsAt > now.getTime())) {
        hasScheduledSale = true;
      }
    }

    return {
      id: product.id,
      slug: product.slug,
      title: product.title,
      status: product.status,
      variantCount: own.length,
      priceFromMinor: own.length > 0 ? Math.min(...own.map((v) => v.priceMinor)) : 0,
      inStock: own.reduce((sum, variant) => sum + Math.max(0, variant.stockQty), 0),
      saleStatus:
        activeSaleVariantCount > 0 ? "active" : hasScheduledSale ? "scheduled" : null,
      saleDiscountPercent,
      activeSaleVariantCount,
    };
  });
}

export async function getProductForAdmin(id: string): Promise<AdminProductDetail | null> {
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!product) return null;

  const [optionRows, mediaRows] = await Promise.all([
    db
      .select()
      .from(productOptions)
      .where(eq(productOptions.productId, product.id))
      .orderBy(asc(productOptions.position)),
    db
      .select()
      .from(productMedia)
      .where(eq(productMedia.productId, product.id))
      .orderBy(asc(productMedia.position)),
  ]);

  const optionIds = optionRows.map((option) => option.id);
  const [valueRows, nodes] = await Promise.all([
    optionIds.length > 0
      ? db
          .select()
          .from(productOptionValues)
          .where(inArray(productOptionValues.optionId, optionIds))
          .orderBy(asc(productOptionValues.position))
      : Promise.resolve([]),
    listVariantNodes(product.id),
  ]);

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    status: product.status,
    options: optionRows.map((option) => ({
      id: option.id,
      name: option.name,
      values: valueRows
        .filter((value) => value.optionId === option.id)
        .map((value) => ({ id: value.id, value: value.value })),
    })),
    nodes,
    media: mediaRows.map((row) => ({
      id: row.id,
      storageKey: row.storageKey,
      alt: row.alt,
    })),
  };
}
