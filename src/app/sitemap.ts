import type { MetadataRoute } from "next";
import { flattenCategoryTree } from "@/lib/categories";

// The catalog is database data. Building must never require a live database, so
// the sitemap is rendered per request rather than prerendered into the image.
export const dynamic = "force-dynamic";
import { listCatalog } from "@/server/services/catalog";
import { listActiveCollections } from "@/server/services/collections";
import { listCategoryTree } from "@/server/services/categories";
import { listPages } from "@/server/services/pages";
import { listActivePromotions } from "@/server/services/promotions";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_STORE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );

  const [products, categories, collections, promotions, pages] = await Promise.all([
    listCatalog(),
    listCategoryTree(),
    listActiveCollections(),
    listActivePromotions(),
    listPages(true),
  ]);

  const flatCategories = flattenCategoryTree(categories);
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/ar`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
  ];

  for (const product of products) {
    entries.push({
      url: `${base}/products/${product.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
    entries.push({
      url: `${base}/ar/products/${product.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  for (const category of flatCategories) {
    entries.push({
      url: `${base}/category/${category.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    });
    entries.push({
      url: `${base}/ar/category/${category.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  for (const collection of collections) {
    entries.push({
      url: `${base}/collections/${collection.slug}`,
      lastModified: collection.updatedAt,
      changeFrequency: "weekly",
      priority: 0.6,
    });
    entries.push({
      url: `${base}/ar/collections/${collection.slug}`,
      lastModified: collection.updatedAt,
      changeFrequency: "weekly",
      priority: 0.5,
    });
  }

  for (const promotion of promotions) {
    entries.push({
      url: `${base}${promotion.href}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.6,
    });
    entries.push({
      url: `${base}/ar${promotion.href}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.5,
    });
  }

  for (const page of pages) {
    entries.push({
      url: `${base}/pages/${page.slug}`,
      lastModified: page.updatedAt,
      changeFrequency: "monthly",
      priority: 0.3,
    });
    entries.push({
      url: `${base}/ar/pages/${page.slug}`,
      lastModified: page.updatedAt,
      changeFrequency: "monthly",
      priority: 0.3,
    });
  }

  return entries;
}
