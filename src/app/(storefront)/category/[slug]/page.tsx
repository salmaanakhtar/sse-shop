import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductGrid } from "@/components/storefront/product-grid";
import { localePath, translate } from "@/lib/i18n";
import { listCatalog } from "@/server/services/catalog";
import {
  getActiveCategoryPage,
  listProductsInCategoryTree,
} from "@/server/services/categories";
import { getLocale, getNumeralPreference } from "@/server/services/preferences";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getActiveCategoryPage(slug);
  if (!page) return {};
  const base = process.env.NEXT_PUBLIC_STORE_URL ?? "http://localhost:3000";
  const canonical = `${base}/category/${page.category.slug}`;
  return {
    title: page.category.name,
    description: page.category.description || undefined,
    alternates: {
      canonical,
      languages: { en: canonical, ar: `${base}/ar/category/${page.category.slug}` },
    },
    openGraph: {
      title: page.category.name,
      description: page.category.description || undefined,
      url: canonical,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getActiveCategoryPage(slug);
  if (!page) notFound();

  const [ids, catalog, locale, numerals] = await Promise.all([
    listProductsInCategoryTree(page.category),
    listCatalog(),
    getLocale(),
    getNumeralPreference(),
  ]);

  const idSet = new Set(ids);
  const products = catalog.filter((product) => idSet.has(product.id));
  const { category, path } = page;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href={localePath(locale, "/")} className="hover:text-ink">
              {translate(locale, "common.home")}
            </Link>
          </li>
          {path.map((item, index) => (
            <li key={item.id} className="flex items-center gap-2">
              <span aria-hidden>/</span>
              {index === path.length - 1 ? (
                <span className="text-ink">{item.name}</span>
              ) : (
                <Link
                  href={localePath(locale, `/category/${item.slug}`)}
                  className="hover:text-ink"
                >
                  {item.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <header className="mt-6 mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{category.name}</h1>
        {category.description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {category.description}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-muted">
          {translate(locale, products.length === 1 ? "home.product" : "home.products", {
            count: products.length,
          })}
        </p>
      </header>

      {category.children.length > 0 ? (
        <nav aria-label="Subcategories" className="mb-6 flex flex-wrap gap-2">
          {category.children.map((child) => (
            <Link
              key={child.id}
              href={localePath(locale, `/category/${child.slug}`)}
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-muted transition-colors hover:border-brand/40 hover:text-ink"
            >
              {child.name}
            </Link>
          ))}
        </nav>
      ) : null}

      <ProductGrid
        products={products}
        label={`${category.name} products`}
        emptyMessage={translate(locale, "home.empty")}
        locale={locale}
        numerals={numerals}
      />
    </div>
  );
}
