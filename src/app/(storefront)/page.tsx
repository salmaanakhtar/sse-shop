import { ProductCard } from "@/components/storefront/product-card";
import { listCatalog } from "@/server/services/catalog";
import { getStoreSettings } from "@/server/services/settings";

export default async function HomePage() {
  const [products, settings] = await Promise.all([listCatalog(), getStoreSettings()]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <section className="mb-12">
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
          {settings.name}
        </p>
        <h1 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Considered goods, delivered across the UAE.
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
          Free delivery over AED 200. Every price includes 5% VAT.
        </p>
      </section>

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center text-sm text-muted">
          Nothing is published yet.
        </div>
      ) : (
        <section
          aria-label="Products"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </section>
      )}
    </div>
  );
}
