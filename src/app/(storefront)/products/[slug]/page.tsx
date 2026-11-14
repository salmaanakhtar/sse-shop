import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductDetailView } from "@/components/storefront/product-detail-view";
import { ProductGrid } from "@/components/storefront/product-grid";
import { ProductReviews } from "@/components/storefront/product-reviews";
import { translate } from "@/lib/i18n";
import { getAuthSession } from "@/server/auth/guard";
import { getProductDetail } from "@/server/services/catalog";
import { getLocale, getNumeralPreference } from "@/server/services/preferences";
import { listRelatedProducts } from "@/server/services/related";
import {
  getMyReview,
  getReviewSummary,
  hasPurchasedProduct,
  listApprovedReviews,
} from "@/server/services/reviews";
import {
  checkWishlistPriceDropsForProduct,
  getWishlistStateForProduct,
  type WishlistStateForProduct,
} from "@/server/services/wishlists";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [product, locale] = await Promise.all([getProductDetail(slug), getLocale()]);
  if (!product) return {};
  const base = process.env.NEXT_PUBLIC_STORE_URL ?? "http://localhost:3000";
  const canonical = `${base}/products/${product.slug}`;
  return {
    title: product.title,
    description: product.description.slice(0, 240) || undefined,
    alternates: {
      canonical,
      languages: { en: canonical, ar: `${base}/ar/products/${product.slug}` },
    },
    openGraph: {
      type: "website",
      title: product.title,
      description: product.description.slice(0, 240) || undefined,
      url: canonical,
      images: product.media[0] ? [`${base}/media/${product.media[0].storageKey}`] : undefined,
      locale: locale === "ar" ? "ar_AE" : "en_AE",
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [product, session] = await Promise.all([getProductDetail(slug), getAuthSession()]);

  if (!product) notFound();

  let wishlist: WishlistStateForProduct | null = null;
  let canReview = false;
  let myReviewStatus: "pending" | "approved" | "rejected" | undefined;

  if (session) {
    wishlist = await getWishlistStateForProduct(session.user.id, product.id);
    await checkWishlistPriceDropsForProduct(session.user.id, product.id).catch((error) => {
      console.error("wishlist price check failed", error);
    });
    const [purchased, myReview] = await Promise.all([
      hasPurchasedProduct(session.user.id, product.id),
      getMyReview(session.user.id, product.id),
    ]);
    canReview = purchased;
    myReviewStatus = myReview?.status;
  }

  const [reviews, summary, related, locale, numerals] = await Promise.all([
    listApprovedReviews(product.id),
    getReviewSummary(product.id),
    listRelatedProducts(product.id),
    getLocale(),
    getNumeralPreference(),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: product.media[0]
      ? `${process.env.NEXT_PUBLIC_STORE_URL ?? "http://localhost:3000"}/media/${product.media[0].storageKey}`
      : undefined,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "AED",
      lowPrice: (product.priceFromMinor / 100).toFixed(2),
      offerCount: Math.max(1, product.nodes.filter((node) => node.variant).length),
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <ProductDetailView product={product} wishlist={wishlist} />
      <ProductReviews
        productId={product.id}
        reviews={reviews}
        summary={summary}
        canReview={canReview}
        myReviewStatus={myReviewStatus}
      />
      {related.length > 0 ? (
        <section className="mx-auto max-w-5xl px-6 pb-16">
          <h2 className="mb-4 border-t border-line pt-8 text-lg font-semibold tracking-tight">
            {translate(locale, "product.related")}
          </h2>
          <ProductGrid
            products={related}
            label={translate(locale, "product.related")}
            locale={locale}
            numerals={numerals}
          />
        </section>
      ) : null}
    </>
  );
}
