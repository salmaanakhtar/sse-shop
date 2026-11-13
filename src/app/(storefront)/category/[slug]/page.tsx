import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/storefront/product-grid";
import { listCatalog } from "@/server/services/catalog";
import {
  getActiveCategoryPage,
  listProductsInCategoryTree,
} from "@/server/services/categories";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getActiveCategoryPage(slug);
  if (!page) notFound();

  const [ids, catalog] = await Promise.all([
    listProductsInCategoryTree(page.category),
    listCatalog(),
  ]);

  const idSet = new Set(ids);
  const products = catalog.filter((product) => idSet.has(product.id));
  const { category, path } = page;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-ink">
              Home
            </Link>
          </li>
          {path.map((item, index) => (
            <li key={item.id} className="flex items-center gap-2">
              <span aria-hidden>/</span>
              {index === path.length - 1 ? (
                <span className="text-ink">{item.name}</span>
              ) : (
                <Link href={`/category/${item.slug}`} className="hover:text-ink">
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
          {products.length} {products.length === 1 ? "product" : "products"}
        </p>
      </header>

      {category.children.length > 0 ? (
        <nav aria-label="Subcategories" className="mb-6 flex flex-wrap gap-2">
          {category.children.map((child) => (
            <Link
              key={child.id}
              href={`/category/${child.slug}`}
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
        emptyMessage="No products in this category yet."
      />
    </div>
  );
}
