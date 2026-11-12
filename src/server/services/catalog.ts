import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import {
  productMedia,
  productOptionValues,
  productOptions,
  products,
  variantOptionValues,
  variants,
} from "../db/schema";

export type CatalogCard = {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceFromMinor: number;
  inStock: boolean;
  imageKey: string | null;
  imageAlt: string;
};

export type ProductOptionView = {
  id: string;
  name: string;
  values: { id: string; value: string }[];
};

export type ProductVariantView = {
  id: string;
  title: string;
  sku: string;
  priceMinor: number;
  stockQty: number;
  optionValueIds: string[];
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
  variants: ProductVariantView[];
  media: ProductMediaView[];
  priceFromMinor: number;
  inStock: boolean;
};

function firstBy<T>(rows: T[], key: (row: T) => string): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    const k = key(row);
    if (!map.has(k)) map.set(k, row);
  }
  return map;
}

export async function listCatalog(): Promise<CatalogCard[]> {
  const productRows = await db
    .select()
    .from(products)
    .where(eq(products.status, "active"))
    .orderBy(desc(products.publishedAt), asc(products.title));

  if (productRows.length === 0) return [];

  const ids = productRows.map((row) => row.id);

  const [variantRows, mediaRows] = await Promise.all([
    db
      .select()
      .from(variants)
      .where(and(inArray(variants.productId, ids), eq(variants.active, true))),
    db
      .select()
      .from(productMedia)
      .where(inArray(productMedia.productId, ids))
      .orderBy(asc(productMedia.position)),
  ]);

  const firstImage = firstBy(mediaRows, (row) => row.productId);

  return productRows.map((product) => {
    const own = variantRows.filter((variant) => variant.productId === product.id);
    const media = firstImage.get(product.id);

    return {
      id: product.id,
      slug: product.slug,
      title: product.title,
      description: product.description,
      priceFromMinor: own.length > 0 ? Math.min(...own.map((v) => v.priceMinor)) : 0,
      inStock: own.some((variant) => variant.stockQty > 0),
      imageKey: media?.storageKey ?? null,
      imageAlt: media?.alt ?? product.title,
    };
  });
}

export async function getProductDetail(slug: string): Promise<ProductDetail | null> {
  const [product] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  if (!product || product.status !== "active") return null;

  const [optionRows, variantRows, mediaRows] = await Promise.all([
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
  ]);

  const optionIds = optionRows.map((option) => option.id);
  const valueRows =
    optionIds.length > 0
      ? await db
          .select()
          .from(productOptionValues)
          .where(inArray(productOptionValues.optionId, optionIds))
          .orderBy(asc(productOptionValues.position))
      : [];

  const variantIds = variantRows.map((variant) => variant.id);
  const links =
    variantIds.length > 0
      ? await db
          .select()
          .from(variantOptionValues)
          .where(inArray(variantOptionValues.variantId, variantIds))
      : [];

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
    variants: variantRows.map((variant) => ({
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      priceMinor: variant.priceMinor,
      stockQty: variant.stockQty,
      optionValueIds: links
        .filter((link) => link.variantId === variant.id)
        .map((link) => link.optionValueId),
    })),
    media: mediaRows.map((row) => ({
      storageKey: row.storageKey,
      alt: row.alt,
      width: row.width,
      height: row.height,
    })),
    priceFromMinor: variantRows.length > 0 ? Math.min(...variantRows.map((v) => v.priceMinor)) : 0,
    inStock: variantRows.some((variant) => variant.stockQty > 0),
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
};

export type AdminProductDetail = {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: "draft" | "active" | "archived";
  options: ProductOptionView[];
  variants: {
    id: string;
    title: string;
    sku: string;
    priceMinor: number;
    stockQty: number;
    active: boolean;
    optionValueIds: string[];
  }[];
  media: { id: string; storageKey: string; alt: string }[];
};

export async function listAdminProducts(): Promise<AdminProductRow[]> {
  const rows = await db.select().from(products).orderBy(desc(products.updatedAt));
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const variantRows = await db.select().from(variants).where(inArray(variants.productId, ids));

  return rows.map((product) => {
    const own = variantRows.filter((variant) => variant.productId === product.id);
    return {
      id: product.id,
      slug: product.slug,
      title: product.title,
      status: product.status,
      variantCount: own.length,
      priceFromMinor: own.length > 0 ? Math.min(...own.map((v) => v.priceMinor)) : 0,
      inStock: own.reduce((sum, variant) => sum + Math.max(0, variant.stockQty), 0),
    };
  });
}

export async function getProductForAdmin(id: string): Promise<AdminProductDetail | null> {
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!product) return null;

  const [optionRows, variantRows, mediaRows] = await Promise.all([
    db
      .select()
      .from(productOptions)
      .where(eq(productOptions.productId, product.id))
      .orderBy(asc(productOptions.position)),
    db
      .select()
      .from(variants)
      .where(eq(variants.productId, product.id))
      .orderBy(asc(variants.position), asc(variants.sku)),
    db
      .select()
      .from(productMedia)
      .where(eq(productMedia.productId, product.id))
      .orderBy(asc(productMedia.position)),
  ]);

  const optionIds = optionRows.map((option) => option.id);
  const valueRows =
    optionIds.length > 0
      ? await db
          .select()
          .from(productOptionValues)
          .where(inArray(productOptionValues.optionId, optionIds))
          .orderBy(asc(productOptionValues.position))
      : [];

  const variantIds = variantRows.map((variant) => variant.id);
  const links =
    variantIds.length > 0
      ? await db
          .select()
          .from(variantOptionValues)
          .where(inArray(variantOptionValues.variantId, variantIds))
      : [];

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
    variants: variantRows.map((variant) => ({
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      priceMinor: variant.priceMinor,
      stockQty: variant.stockQty,
      active: variant.active,
      optionValueIds: links
        .filter((link) => link.variantId === variant.id)
        .map((link) => link.optionValueId),
    })),
    media: mediaRows.map((row) => ({
      id: row.id,
      storageKey: row.storageKey,
      alt: row.alt,
    })),
  };
}
