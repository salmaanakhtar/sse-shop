import Image from "next/image";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { CatalogCard as CatalogCardData } from "@/server/services/catalog";

export function ProductCard({ product }: { product: CatalogCardData }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-brand/40"
    >
      <div className="relative aspect-square overflow-hidden bg-page">
        {product.imageKey ? (
          <Image
            src={`/media/${product.imageKey}`}
            alt={product.imageAlt}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted">
            No image yet
          </div>
        )}
      </div>

      <div className="space-y-1 p-4">
        <h2 className="text-sm font-medium">{product.title}</h2>
        <p className="text-sm text-muted">
          {product.inStock ? formatMoney(product.priceFromMinor) : "Sold out"}
        </p>
      </div>
    </Link>
  );
}
