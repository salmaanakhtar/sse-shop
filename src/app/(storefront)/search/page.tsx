import Link from "next/link";
import type { Metadata } from "next";
import { ProductGrid } from "@/components/storefront/product-grid";
import {
  buildCategoryTree,
  flattenCategoryTree,
} from "@/lib/categories";
import { localePath, translate } from "@/lib/i18n";
import { parseMoney } from "@/lib/money";
import { listCategoryTree } from "@/server/services/categories";
import { getLocale, getNumeralPreference } from "@/server/services/preferences";
import { searchCatalog, type CatalogSort } from "@/server/services/search";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

type SearchParams = {
  q?: string;
  category?: string;
  min?: string;
  max?: string;
  stock?: string;
  sort?: string;
  page?: string;
};

function sortValue(value: string | undefined): CatalogSort {
  return ["newest", "price-asc", "price-desc", "title"].includes(value ?? "")
    ? (value as CatalogSort)
    : "newest";
}

function pageHref(
  locale: "en" | "ar",
  params: SearchParams,
  page: number,
): string {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.category) query.set("category", params.category);
  if (params.min) query.set("min", params.min);
  if (params.max) query.set("max", params.max);
  if (params.stock) query.set("stock", params.stock);
  if (params.sort) query.set("sort", params.sort);
  query.set("page", String(page));
  return `${localePath(locale, "/search")}?${query.toString()}`;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [params, locale, numerals] = await Promise.all([
    searchParams,
    getLocale(),
    getNumeralPreference(),
  ]);
  const minPriceMinor = params.min ? parseMoney(params.min) : null;
  const maxPriceMinor = params.max ? parseMoney(params.max) : null;
  const result = await searchCatalog({
    q: params.q,
    categorySlug: params.category || undefined,
    minPriceMinor,
    maxPriceMinor,
    inStockOnly: params.stock === "1",
    sort: sortValue(params.sort),
    page: Number(params.page ?? 1),
  });

  const categories = flattenCategoryTree(
    buildCategoryTree(await listCategoryTree()),
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {translate(locale, "search.title")}
      </h1>

      <form
        action={localePath(locale, "/search")}
        method="get"
        className="mt-6 grid gap-3 rounded-xl border border-line bg-surface p-5 sm:grid-cols-2 lg:grid-cols-6"
      >
        <div className="sm:col-span-2">
          <label
            htmlFor="search-q"
            className="mb-1.5 block text-xs font-semibold tracking-wide text-muted uppercase"
          >
            {translate(locale, "common.search")}
          </label>
          <input
            id="search-q"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder={translate(locale, "search.placeholder")}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="search-category"
            className="mb-1.5 block text-xs font-semibold tracking-wide text-muted uppercase"
          >
            {translate(locale, "search.category")}
          </label>
          <select
            id="search-category"
            name="category"
            defaultValue={params.category ?? ""}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="">{translate(locale, "search.allCategories")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {"— ".repeat(category.depth)}
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="search-min"
            className="mb-1.5 block text-xs font-semibold tracking-wide text-muted uppercase"
          >
            {translate(locale, "search.minPrice")}
          </label>
          <input
            id="search-min"
            name="min"
            inputMode="decimal"
            defaultValue={params.min ?? ""}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="search-max"
            className="mb-1.5 block text-xs font-semibold tracking-wide text-muted uppercase"
          >
            {translate(locale, "search.maxPrice")}
          </label>
          <input
            id="search-max"
            name="max"
            inputMode="decimal"
            defaultValue={params.max ?? ""}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="search-sort"
            className="mb-1.5 block text-xs font-semibold tracking-wide text-muted uppercase"
          >
            {translate(locale, "search.sort")}
          </label>
          <select
            id="search-sort"
            name="sort"
            defaultValue={sortValue(params.sort)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="newest">{translate(locale, "search.newest")}</option>
            <option value="price-asc">{translate(locale, "search.priceAsc")}</option>
            <option value="price-desc">{translate(locale, "search.priceDesc")}</option>
            <option value="title">{translate(locale, "search.titleSort")}</option>
          </select>
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input
            type="checkbox"
            name="stock"
            value="1"
            defaultChecked={params.stock === "1"}
            className="size-4"
          />
          {translate(locale, "search.inStock")}
        </label>
        <div className="self-end sm:col-span-2 lg:col-span-6">
          <button
            type="submit"
            className="h-9 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand/90"
          >
            {translate(locale, "search.apply")}
          </button>
        </div>
      </form>

      {!result.ok ? (
        <p role="alert" className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {result.error}
        </p>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted">
            {translate(locale, "search.results", { count: result.data.total })}
          </p>

          <div className="mt-4">
            <ProductGrid
              products={result.data.products}
              label={translate(locale, "search.title")}
              emptyMessage={translate(locale, "search.empty")}
              locale={locale}
              numerals={numerals}
            />
          </div>

          {result.data.pageCount > 1 ? (
            <nav aria-label="Pagination" className="mt-8 flex items-center justify-between">
              {result.data.page > 1 ? (
                <Link
                  href={pageHref(locale, params, result.data.page - 1)}
                  className="text-sm text-muted hover:text-ink"
                >
                  {translate(locale, "search.previous")}
                </Link>
              ) : (
                <span />
              )}
              <span className="text-xs text-muted">
                {result.data.page} / {result.data.pageCount}
              </span>
              {result.data.page < result.data.pageCount ? (
                <Link
                  href={pageHref(locale, params, result.data.page + 1)}
                  className="text-sm text-muted hover:text-ink"
                >
                  {translate(locale, "search.next")}
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
