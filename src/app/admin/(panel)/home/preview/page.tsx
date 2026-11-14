import Link from "next/link";
import { ProductGrid } from "@/components/storefront/product-grid";
import { PromotionCarousel } from "@/components/storefront/promotion-carousel";
import { formatMoney } from "@/lib/money";
import { localePath, translate } from "@/lib/i18n";
import { requireAdminPage } from "@/server/auth/guard";
import { loadHomeSections } from "@/server/services/home-sections";
import { getLocale, getNumeralPreference } from "@/server/services/preferences";
import { getStoreSettings } from "@/server/services/settings";

export const metadata = { title: "Homepage preview" };

export default async function AdminHomePreviewPage() {
  await requireAdminPage();
  const [sections, settings, locale, numerals] = await Promise.all([
    loadHomeSections({ includeInactive: true }),
    getStoreSettings(),
    getLocale(),
    getNumeralPreference(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Homepage preview</h1>
          <p className="mt-1 text-sm text-muted">
            Shows active and inactive sections. Inactive sections are outlined and marked below.
          </p>
        </div>
        <Link href="/admin/home" className="text-sm text-muted hover:text-ink">
          Back to composer
        </Link>
      </div>

      <div className="space-y-8 rounded-2xl border border-line bg-page p-6">
        {sections.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">
            No sections yet. The storefront uses its built-in hero and product grid.
          </p>
        ) : (
          sections.map((section) => (
            <section
              key={section.id}
              className={
                section.active
                  ? "border-b border-line pb-8 last:border-0"
                  : "rounded-xl border-2 border-dashed border-amber-300 p-4 pb-8"
              }
            >
              <p className="mb-3 flex items-center gap-2 text-[10px] font-semibold tracking-wide text-muted uppercase">
                <span>
                  {section.kind} · {section.id.slice(0, 8)}
                </span>
                {section.active ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                    active
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                    inactive — hidden from shoppers
                  </span>
                )}
              </p>

              {section.kind === "promotions" ? (
                <PromotionCarousel promotions={section.promotions} />
              ) : section.kind === "hero" ? (
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
                    {settings.name}
                  </p>
                  {section.title ? (
                    <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-balance">
                      {section.title}
                    </h2>
                  ) : null}
                  {section.body ? (
                    <p className="mt-3 max-w-lg text-sm whitespace-pre-line text-muted">
                      {section.body}
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs text-muted">
                    {formatMoney(settings.shippingFreeThresholdMinor, { locale, numerals })} free
                    delivery threshold
                  </p>
                </div>
              ) : section.kind === "text" ? (
                <div>
                  {section.title ? (
                    <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
                  ) : null}
                  {section.body ? (
                    <p className="mt-2 max-w-2xl text-sm whitespace-pre-line text-muted">
                      {section.body}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div>
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
                      {section.body ? (
                        <p className="mt-1 text-sm text-muted">{section.body}</p>
                      ) : null}
                    </div>
                    {section.collectionSlug ? (
                      <Link
                        href={localePath(locale, `/collections/${section.collectionSlug}`)}
                        className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
                      >
                        {translate(locale, "home.viewAll")}
                      </Link>
                    ) : null}
                  </div>
                  <ProductGrid
                    products={section.products}
                    label={`${section.title} preview`}
                    locale={locale}
                    numerals={numerals}
                    emptyMessage="No products resolve for this section."
                  />
                </div>
              )}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
