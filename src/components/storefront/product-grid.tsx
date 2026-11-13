import { ProductCard } from "@/components/storefront/product-card";
import type { CatalogCard } from "@/server/services/catalog";

export function ProductGrid({
  products,
  label,
  emptyMessage = "Nothing is published here yet.",
}: {
  products: CatalogCard[];
  label: string;
  emptyMessage?: string;
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
        <ProductCard key={product.id} product={product} />
      ))}
    </section>
  );
}
