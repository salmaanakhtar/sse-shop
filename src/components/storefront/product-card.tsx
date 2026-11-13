import Image from "next/image";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { discountPercent } from "@/lib/sale";
import type { CatalogCard as CatalogCardData } from "@/server/services/catalog";

export function ProductCard({ product }: { product: CatalogCardData }) {
  const discount =
    product.compareAtFromMinor !== null
      ? discountPercent(product.compareAtFromMinor, product.priceFromMinor)
      : null;

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
        {product.onSale ? (
          <span className="absolute left-3 top-3 rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
            Sale{discount !== null ? ` −${discount}%` : ""}
          </span>
        ) : null}
      </div>

      <div className="space-y-1 p-4">
        <h2 className="text-sm font-medium">{product.title}</h2>
        {product.inStock ? (
          <p className="flex items-baseline gap-2 text-sm text-muted">
            <span>{formatMoney(product.priceFromMinor)}</span>
            {product.compareAtFromMinor !== null ? (
              <span className="text-xs line-through">
                {formatMoney(product.compareAtFromMinor)}
              </span>
            ) : null}
          </p>
        ) : (
          <p className="text-sm text-muted">Sold out</p>
        )}
      </div>
    </Link>
  );
}
