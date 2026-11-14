import { describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import {
  orders,
  orderItems,
  productReviews,
  products,
  users,
  variants,
} from "@/server/db/schema";
import { addCollectionProduct, createCollection } from "@/server/services/collections";
import { createCategory, setProductCategories } from "@/server/services/categories";
import { searchCatalog } from "@/server/services/search";
import {
  getReviewSummary,
  hasPurchasedProduct,
  listApprovedReviews,
  moderateReview,
  submitReview,
} from "@/server/services/reviews";
import { listRelatedProducts } from "@/server/services/related";

const suffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function createProduct(title: string, priceMinor = 10_000, stockQty = 5) {
  const [product] = await db
    .insert(products)
    .values({
      slug: `discover-${suffix()}`,
      title,
      description: `${title} description`,
      status: "active",
      publishedAt: new Date(),
    })
    .returning();
  if (!product) throw new Error("could not create the test product");

  const [variant] = await db
    .insert(variants)
    .values({
      productId: product.id,
      sku: `DISCOVER-${suffix()}`,
      title: "Default",
      priceMinor,
      stockQty,
    })
    .returning();
  if (!variant) throw new Error("could not create the test variant");

  return { product, variant };
}

async function createCustomer() {
  const [user] = await db
    .insert(users)
    .values({ name: "Review Customer", email: `review-${suffix()}@example.com` })
    .returning();
  if (!user) throw new Error("could not create the test customer");
  return user;
}

describe("catalog discovery", () => {
  it("searches, filters, sorts, and paginates active products", async () => {
    const alpha = await createProduct("Alpha Hoodie", 20_000, 3);
    const beta = await createProduct("Beta Cap", 5_000, 0);
    const gamma = await createProduct("Gamma Hoodie", 12_000, 2);

    const category = await createCategory({
      name: "Discovery",
      slug: `discovery-${suffix()}`,
      description: "",
      parentId: null,
      active: true,
    });
    expect(category.ok).toBe(true);
    if (!category.ok) return;
    await setProductCategories(alpha.product.id, [category.data.id]);

    const found = await searchCatalog({ q: "Hoodie" });
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(new Set(found.data.products.map((item) => item.id))).toEqual(
      new Set([alpha.product.id, gamma.product.id]),
    );

    const inCategory = await searchCatalog({
      q: "Hoodie",
      categorySlug: category.data.slug,
    });
    expect(inCategory.ok).toBe(true);
    if (!inCategory.ok) return;
    expect(inCategory.data.products.map((item) => item.id)).toEqual([alpha.product.id]);

    const priceSorted = await searchCatalog({ sort: "price-asc" });
    expect(priceSorted.ok).toBe(true);
    if (!priceSorted.ok) return;
    expect(priceSorted.data.products[0]?.id).toBe(beta.product.id);
    expect(priceSorted.data.products.at(-1)?.id).toBe(alpha.product.id);

    const inStock = await searchCatalog({ inStockOnly: true });
    expect(inStock.ok).toBe(true);
    if (!inStock.ok) return;
    expect(inStock.data.products.map((item) => item.id)).not.toContain(beta.product.id);

    const paginated = await searchCatalog({ page: 1, pageSize: 2 });
    expect(paginated.ok).toBe(true);
    if (!paginated.ok) return;
    expect(paginated.data.total).toBe(3);
    expect(paginated.data.pageCount).toBe(2);
    expect(paginated.data.products).toHaveLength(2);
  });

  it("accepts a verified review, keeps it pending, then publishes it", async () => {
    const customer = await createCustomer();
    const { product, variant } = await createProduct("Reviewed Product");

    const [order] = await db
      .insert(orders)
      .values({
        number: `SS-2099-${suffix()}`,
        lookupTokenHash: `hash-${suffix()}`,
        lookupExpiresAt: new Date(Date.now() + 86_400_000),
        userId: customer.id,
        email: customer.email,
        status: "confirmed",
        paymentStatus: "paid",
        subtotalMinor: 10_000,
        totalMinor: 10_000,
        shippingAddress: {
          fullName: "Review Customer",
          phone: "+971501234567",
          emirate: "Dubai",
          building: "1",
          street: "Test Street",
          area: "",
          poBox: "",
          notes: "",
        },
      })
      .returning();
    if (!order) throw new Error("could not create the test order");

    await db.insert(orderItems).values({
      orderId: order.id,
      variantId: variant.id,
      sku: variant.sku,
      title: product.title,
      unitPriceMinor: 10_000,
      quantity: 1,
      lineTotalMinor: 10_000,
    });

    expect(await hasPurchasedProduct(customer.id, product.id)).toBe(true);

    const result = await submitReview(customer.id, product.id, {
      rating: 5,
      title: "Great",
      body: "This is a genuinely useful product.",
    });
    expect(result.ok).toBe(true);
    expect((await getReviewSummary(product.id)).count).toBe(0);

    const [pending] = await db.select().from(productReviews).limit(1);
    if (!pending) throw new Error("missing review");

    expect((await moderateReview(pending.id, "approved")).ok).toBe(true);
    expect((await getReviewSummary(product.id)).count).toBe(1);
    expect((await listApprovedReviews(product.id))[0]?.body).toContain("genuinely useful");
  });

  it("rejects a review from a customer without a paid order", async () => {
    const customer = await createCustomer();
    const { product } = await createProduct("Unbought Product");

    const result = await submitReview(customer.id, product.id, {
      rating: 4,
      title: "",
      body: "I did not buy this product.",
    });
    expect(result.ok).toBe(false);
  });

  it("ranks shared-category and shared-collection products before fallbacks", async () => {
    const current = await createProduct("Current Product");
    const sameCategory = await createProduct("Same Category");
    const sameCollection = await createProduct("Same Collection");
    const fallback = await createProduct("Fallback Product");

    const category = await createCategory({
      name: "Related",
      slug: `related-${suffix()}`,
      description: "",
      parentId: null,
      active: true,
    });
    expect(category.ok).toBe(true);
    if (!category.ok) return;
    await setProductCategories(current.product.id, [category.data.id]);
    await setProductCategories(sameCategory.product.id, [category.data.id]);

    const collection = await createCollection({
      name: "Related Collection",
      slug: `related-collection-${suffix()}`,
      description: "",
      active: true,
    });
    expect(collection.ok).toBe(true);
    if (!collection.ok) return;
    await addCollectionProduct(collection.data.id, current.product.id);
    await addCollectionProduct(collection.data.id, sameCollection.product.id);

    const related = await listRelatedProducts(current.product.id, 3);
    const ids = related.map((item) => item.id);
    expect(ids[0]).toBe(sameCategory.product.id);
    expect(ids[1]).toBe(sameCollection.product.id);
    expect(ids[2]).toBe(fallback.product.id);
    expect(ids).not.toContain(current.product.id);
  });
});
