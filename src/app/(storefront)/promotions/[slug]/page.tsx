import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductGrid } from "@/components/storefront/product-grid";
import { localePath, translate } from "@/lib/i18n";
import { getActivePromotionPage } from "@/server/services/promotions";
import { getLocale, getNumeralPreference } from "@/server/services/preferences";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getActivePromotionPage(slug);
  if (!page) return {};
  const base = process.env.NEXT_PUBLIC_STORE_URL ?? "http://localhost:3000";
  const canonical = `${base}/promotions/${page.promotion.slug}`;
  return {
    title: page.promotion.headline || "Promotion",
    description: page.promotion.subheadline || undefined,
    alternates: {
      canonical,
      languages: {
        en: canonical,
        ar: `${base}/ar/promotions/${page.promotion.slug}`,
      },
    },
    openGraph: {
      title: page.promotion.headline || "Promotion",
      description: page.promotion.subheadline || undefined,
      url: canonical,
      images: [`${base}/media/${page.promotion.imageKey}`],
    },
  };
}

export default async function PromotionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getActivePromotionPage(slug);
  if (!page) notFound();

  const [locale, numerals] = await Promise.all([getLocale(), getNumeralPreference()]);
  const { promotion, rows } = page;

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
            <span className="text-ink">{promotion.headline || "Promotion"}</span>
          </li>
        </ol>
      </nav>

      <header className="relative mt-6 overflow-hidden rounded-2xl border border-line bg-ink">
        <div className="relative aspect-[16/6] min-h-[220px] w-full">
          <Image
            src={`/media/${promotion.imageKey}`}
            alt={promotion.imageAlt || promotion.headline || "Promotion"}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/5" />
          <div className="absolute inset-0 flex flex-col justify-end gap-2 p-6 sm:p-10">
            {promotion.headline ? (
              <h1 className="max-w-2xl text-2xl font-semibold tracking-tight text-white text-balance sm:text-3xl">
                {promotion.headline}
              </h1>
            ) : null}
            {promotion.subheadline ? (
              <p className="max-w-xl text-sm text-white/80">{promotion.subheadline}</p>
            ) : null}
          </div>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-line px-6 py-16 text-center text-sm text-muted">
          {translate(locale, "home.empty")}
        </div>
      ) : (
        <div className="mt-10 space-y-12">
          {rows.map((row) => (
            <section key={row.id}>
              <div className="mb-4 flex items-end justify-between gap-2">
                <h2 className="text-lg font-semibold tracking-tight">{row.title}</h2>
                <span className="text-xs text-muted">
                  {translate(locale, row.products.length === 1 ? "home.product" : "home.products", {
                    count: row.products.length,
                  })}
                </span>
              </div>
              <ProductGrid
                products={row.products}
                label={`${row.title} products`}
                emptyMessage={translate(locale, "home.empty")}
                locale={locale}
                numerals={numerals}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
