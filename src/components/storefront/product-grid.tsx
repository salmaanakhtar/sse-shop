import { ProductCard } from "@/components/storefront/product-card";
import type { Locale, NumeralStyle } from "@/lib/i18n";
import type { CatalogCard } from "@/server/services/catalog";

export function ProductGrid({
  products,
  label,
  emptyMessage = "Nothing is published here yet.",
  locale = "en",
  numerals = "latin",
}: {
  products: CatalogCard[];
  label: string;
  emptyMessage?: string;
  locale?: Locale;
  numerals?: NumeralStyle;
}) {
  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center text-sm text-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <section
      aria-label={label}
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      {products.map((product) => (
        <ProductCard key={product.id} product={product} locale={locale} numerals={numerals} />
      ))}
    </section>
  );
}
