import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductGrid } from "@/components/storefront/product-grid";
import { localePath, translate } from "@/lib/i18n";
import { listCatalogByIds } from "@/server/services/catalog";
import {
  getActiveCollectionBySlug,
  listCollectionProductIds,
} from "@/server/services/collections";
import { getLocale, getNumeralPreference } from "@/server/services/preferences";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getActiveCollectionBySlug(slug);
  if (!collection) return {};
  const base = process.env.NEXT_PUBLIC_STORE_URL ?? "http://localhost:3000";
  const canonical = `${base}/collections/${collection.slug}`;
  return {
    title: collection.name,
    description: collection.description || undefined,
    alternates: {
      canonical,
      languages: {
        en: canonical,
        ar: `${base}/ar/collections/${collection.slug}`,
      },
    },
    openGraph: {
      title: collection.name,
      description: collection.description || undefined,
      url: canonical,
    },
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = await getActiveCollectionBySlug(slug);
  if (!collection) notFound();

  const [products, locale, numerals] = await Promise.all([
    listCatalogByIds(await listCollectionProductIds(collection.id)),
    getLocale(),
    getNumeralPreference(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href={localePath(locale, "/")} className="hover:text-ink">
              {translate(locale, "common.home")}
            </Link>
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden>/</span>
            <span className="text-ink">{collection.name}</span>
          </li>
        </ol>
      </nav>

      <header className="mt-6 mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {collection.name}
        </h1>
        {collection.description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {collection.description}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-muted">
          {translate(locale, products.length === 1 ? "home.product" : "home.products", {
            count: products.length,
          })}
        </p>
      </header>

      <ProductGrid
        products={products}
        label={`${collection.name} products`}
        emptyMessage={translate(locale, "home.empty")}
        locale={locale}
        numerals={numerals}
      />
    </div>
  );
}
