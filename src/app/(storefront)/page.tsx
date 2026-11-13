import Link from "next/link";
import { ProductCard } from "@/components/storefront/product-card";
import { ProductGrid } from "@/components/storefront/product-grid";
import { PromotionCarousel } from "@/components/storefront/promotion-carousel";
import { listCatalog } from "@/server/services/catalog";
import { listHomeCollections } from "@/server/services/collections";
import { listActivePromotions } from "@/server/services/promotions";
import { getStoreSettings } from "@/server/services/settings";

export default async function HomePage() {
  const [products, settings, promotions, collections] = await Promise.all([
    listCatalog(),
    getStoreSettings(),
    listActivePromotions(),
    listHomeCollections(),
  ]);

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
          Free delivery over AED 200. Every price includes 5% VAT.
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
              href={`/collections/${collection.slug}`}
              className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {collection.products.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ))}

      <section>
        <div className="mb-4 flex items-end justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">All products</h2>
          <span className="text-xs text-muted">
            {products.length} {products.length === 1 ? "product" : "products"}
          </span>
        </div>
        <ProductGrid
          products={products}
          label="All products"
          emptyMessage="Nothing is published yet."
        />
      </section>
    </div>
  );
}
