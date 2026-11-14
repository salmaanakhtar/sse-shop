import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { fail, ok, type Result } from "@/lib/result";
import { db } from "../db/client";
import { products } from "../db/schema";
import {
  catalogCardsForProducts,
  type CatalogCard,
} from "./catalog";
import {
  getActiveCategoryPage,
  listProductsInCategoryTree,
} from "./categories";

export const SEARCH_PAGE_SIZE = 12;

export type CatalogSort = "newest" | "price-asc" | "price-desc" | "title";

export type CatalogSearchInput = {
  q?: string;
  categorySlug?: string;
  minPriceMinor?: number | null;
  maxPriceMinor?: number | null;
  inStockOnly?: boolean;
  sort?: CatalogSort;
  page?: number;
  pageSize?: number;
};

export type CatalogSearchResult = {
  products: CatalogCard[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

function isSort(value: string | undefined): value is CatalogSort {
  return ["newest", "price-asc", "price-desc", "title"].includes(value ?? "");
}

export async function searchCatalog(
  input: CatalogSearchInput,
): Promise<Result<CatalogSearchResult>> {
  const q = (input.q ?? "").trim().slice(0, 80);
  const pageSize = Math.min(48, Math.max(1, input.pageSize ?? SEARCH_PAGE_SIZE));
  const requestedPage =
    typeof input.page === "number" && Number.isFinite(input.page)
      ? Math.max(1, Math.floor(input.page))
      : 1;
  const sort: CatalogSort = isSort(input.sort) ? input.sort : "newest";

  if (
    input.minPriceMinor !== null &&
    input.minPriceMinor !== undefined &&
    input.minPriceMinor < 0
  ) {
    return fail("The minimum price must not be negative.");
  }
  if (
    input.maxPriceMinor !== null &&
    input.maxPriceMinor !== undefined &&
    input.maxPriceMinor < 0
  ) {
    return fail("The maximum price must not be negative.");
  }
  if (
    input.minPriceMinor !== null &&
    input.minPriceMinor !== undefined &&
    input.maxPriceMinor !== null &&
    input.maxPriceMinor !== undefined &&
    input.minPriceMinor > input.maxPriceMinor
  ) {
    return fail("The minimum price is above the maximum price.");
  }

  const conditions = [eq(products.status, "active")];
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        ilike(products.title, pattern),
        ilike(products.description, pattern),
        ilike(products.slug, pattern),
      )!,
    );
  }

  let rows = await db
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(desc(products.publishedAt), asc(products.title));

  if (input.categorySlug) {
    const categoryPage = await getActiveCategoryPage(input.categorySlug);
    if (!categoryPage) {
      return ok({ products: [], total: 0, page: 1, pageSize, pageCount: 1 });
    }
    const ids = new Set(await listProductsInCategoryTree(categoryPage.category));
    rows = rows.filter((row) => ids.has(row.id));
  }

  let cards = await catalogCardsForProducts(rows);

  if (input.minPriceMinor !== null && input.minPriceMinor !== undefined) {
    cards = cards.filter((card) => card.priceFromMinor >= input.minPriceMinor!);
  }
  if (input.maxPriceMinor !== null && input.maxPriceMinor !== undefined) {
    cards = cards.filter((card) => card.priceFromMinor <= input.maxPriceMinor!);
  }
  if (input.inStockOnly) {
    cards = cards.filter((card) => card.inStock);
  }

  if (sort === "price-asc") {
    cards.sort((a, b) => a.priceFromMinor - b.priceFromMinor || a.title.localeCompare(b.title));
  } else if (sort === "price-desc") {
    cards.sort((a, b) => b.priceFromMinor - a.priceFromMinor || a.title.localeCompare(b.title));
  } else if (sort === "title") {
    cards.sort((a, b) => a.title.localeCompare(b.title));
  }

  const total = cards.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const start = (page - 1) * pageSize;

  return ok({
    products: cards.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    pageCount,
  });
}
