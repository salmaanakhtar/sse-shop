import { notFound } from "next/navigation";
import { ProductDetailView } from "@/components/storefront/product-detail-view";
import { getAuthSession } from "@/server/auth/guard";
import { getProductDetail } from "@/server/services/catalog";
import {
  checkWishlistPriceDropsForProduct,
  getWishlistStateForProduct,
  type WishlistStateForProduct,
} from "@/server/services/wishlists";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [product, session] = await Promise.all([getProductDetail(slug), getAuthSession()]);

  if (!product) notFound();

  let wishlist: WishlistStateForProduct | null = null;
  if (session) {
    wishlist = await getWishlistStateForProduct(session.user.id, product.id);
    await checkWishlistPriceDropsForProduct(session.user.id, product.id).catch((error) => {
      console.error("wishlist price check failed", error);
    });
  }

  return <ProductDetailView product={product} wishlist={wishlist} />;
}
