import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ProductCard } from "@/components/storefront/product-card";
import { ProductGrid } from "@/components/storefront/product-grid";
import { PromotionCarousel } from "@/components/storefront/promotion-carousel";
import { localePath, translate } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { listCatalog } from "@/server/services/catalog";
import { listHomeCollections } from "@/server/services/collections";
import { loadHomeSections } from "@/server/services/home-sections";
import { listActivePromotions } from "@/server/services/promotions";
import {
  getLocale,
  getLocalePreference,
  getNumeralPreference,
} from "@/server/services/preferences";
import { getStoreSettings } from "@/server/services/settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await connection();
  const [products, settings, promotions, collections, sections, locale, numerals] =
    await Promise.all([
      listCatalog(),
      getStoreSettings(),
      listActivePromotions(),
      listHomeCollections(),
      loadHomeSections(),
      getLocale(),
      getNumeralPreference(),
    ]);

  if (locale === "en" && (await getLocalePreference()) === "ar") {
    redirect("/ar");
  }

  if (sections.length > 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-12 px-6 py-10">
        {sections.map((section) => {
          if (section.kind === "promotions") {
            return <PromotionCarousel key={section.id} promotions={section.promotions} />;
          }

          if (section.kind === "hero") {
            return (
              <section key={section.id}>
                <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
                  {settings.name}
                </p>
                {section.title ? (
                  <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                    {section.title}
                  </h1>
                ) : null}
                {section.body ? (
                  <p className="mt-3 max-w-lg text-sm leading-relaxed whitespace-pre-line text-muted">
                    {section.body}
                  </p>
                ) : null}
              </section>
            );
          }

          if (section.kind === "text") {
            return (
              <section key={section.id}>
                {section.title ? (
                  <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
                ) : null}
                {section.body ? (
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed whitespace-pre-line text-muted">
                    {section.body}
                  </p>
                ) : null}
              </section>
            );
          }

          return (
            <section key={section.id}>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
                  {section.body ? (
                    <p className="mt-1 text-sm text-muted">{section.body}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  {section.kind === "allProducts" ? (
                    <span className="text-xs text-muted">
                      {translate(
                        locale,
                        products.length === 1 ? "home.product" : "home.products",
                        { count: products.length },
                      )}
                    </span>
                  ) : null}
                  {section.collectionSlug ? (
                    <Link
                      href={localePath(locale, `/collections/${section.collectionSlug}`)}
                      className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
                    >
                      {translate(locale, "home.viewAll")}
                    </Link>
                  ) : null}
                </div>
              </div>
              <ProductGrid
                products={section.products}
                label={
                  section.kind === "allProducts"
                    ? translate(locale, "home.allProducts")
                    : `${section.title} products`
                }
                locale={locale}
                numerals={numerals}
              />
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      {promotions.length > 0 ? (
        <div className="mb-10">
          <PromotionCarousel promotions={promotions} />
        </div>
      ) : null}

      <section className="mb-12">
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
          {settings.name}
        </p>
        <h1 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Considered goods, delivered across the UAE.
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
          {settings.shippingFreeThresholdMinor > 0
            ? translate(locale, "home.freeOver", {
                amount: formatMoney(settings.shippingFreeThresholdMinor, { locale, numerals }),
              })
            : translate(locale, "home.freeEvery")}{" "}
          {translate(locale, settings.taxInclusive ? "home.vatIncluded" : "home.vatAdded")}
        </p>
      </section>

      {collections.map((collection) => (
        <section key={collection.id} aria-label={`${collection.name} collection`} className="mb-12">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{collection.name}</h2>
              {collection.description ? (
                <p className="mt-1 text-sm text-muted">{collection.description}</p>
              ) : null}
            </div>
            <Link
              href={localePath(locale, `/collections/${collection.slug}`)}
              className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              {translate(locale, "home.viewAll")}
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {collection.products.slice(0, 4).map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                locale={locale}
                numerals={numerals}
              />
            ))}
          </div>
        </section>
      ))}

      <section>
        <div className="mb-4 flex items-end justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            {translate(locale, "home.allProducts")}
          </h2>
          <span className="text-xs text-muted">
            {translate(locale, products.length === 1 ? "home.product" : "home.products", {
              count: products.length,
            })}
          </span>
        </div>
        <ProductGrid
          products={products}
          label={translate(locale, "home.allProducts")}
          emptyMessage={translate(locale, "home.empty")}
          locale={locale}
          numerals={numerals}
        />
      </section>
    </div>
  );
}
