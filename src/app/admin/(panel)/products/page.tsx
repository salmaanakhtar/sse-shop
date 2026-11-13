import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { listAdminProducts } from "@/server/services/catalog";

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  draft: "bg-amber-50 text-amber-700",
  archived: "bg-zinc-100 text-zinc-600",
};

export default async function AdminProductsPage() {
  const products = await listAdminProducts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Products</h1>
        <Link href="/admin/products/new" className={buttonClass("primary", "sm")}>
          New product
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {products.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-muted">No products yet.</p>
            <Link href="/admin/products/new" className={buttonClass("primary", "sm", "mt-4")}>
              Create the first one
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">Product</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">Status</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">Sale</th>
                <th className="px-5 py-3 font-semibold">Variants</th>
                <th className="hidden px-5 py-3 font-semibold md:table-cell">Stock</th>
                <th className="px-5 py-3 text-right font-semibold">From</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-page/60">
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="font-medium hover:text-brand"
                    >
                      {product.title}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <p className="text-xs text-muted">/{product.slug}</p>
                      {product.saleStatus ? (
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase sm:hidden ${
                            product.saleStatus === "active"
                              ? "bg-brand-soft text-brand"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {product.saleStatus === "active"
                            ? `Sale${product.saleDiscountPercent !== null ? ` ${product.saleDiscountPercent}%` : ""}`
                            : "Sale soon"}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="hidden px-5 py-3 sm:table-cell">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        STATUS_STYLE[product.status] ?? ""
                      }`}
                    >
                      {product.status}
                    </span>
                  </td>
                  <td className="hidden px-5 py-3 sm:table-cell">
                    {product.saleStatus === "active" ? (
                      <span
                        className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand"
                        title={`${product.activeSaleVariantCount} variant${
                          product.activeSaleVariantCount === 1 ? "" : "s"
                        } on sale`}
                      >
                        Sale{product.saleDiscountPercent !== null ? ` ${product.saleDiscountPercent}%` : ""}
                      </span>
                    ) : product.saleStatus === "scheduled" ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Scheduled
                      </span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 tabular-nums">{product.variantCount}</td>
                  <td className="hidden px-5 py-3 tabular-nums md:table-cell">{product.inStock}</td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {formatMoney(product.priceFromMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
