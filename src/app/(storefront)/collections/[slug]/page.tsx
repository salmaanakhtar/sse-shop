import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/storefront/product-grid";
import { listCatalogByIds } from "@/server/services/catalog";
import {
  getActiveCollectionBySlug,
  listCollectionProductIds,
} from "@/server/services/collections";

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = await getActiveCollectionBySlug(slug);
  if (!collection) notFound();

  const products = await listCatalogByIds(
    await listCollectionProductIds(collection.id),
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-ink">
              Home
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
          {products.length} {products.length === 1 ? "product" : "products"}
        </p>
      </header>

      <ProductGrid
        products={products}
        label={`${collection.name} products`}
        emptyMessage="No products in this collection yet."
      />
    </div>
  );
}
