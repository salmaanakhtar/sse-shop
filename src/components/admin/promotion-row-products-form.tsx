"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { addPromotionRowProductsAction } from "@/server/actions/admin-promotions";
import { Button } from "@/components/ui/button";
import type { PromotionRowOptions } from "@/server/services/promotions";

type ProductOption = PromotionRowOptions["products"][number];

export function PromotionRowProductsForm({
  promotionId,
  rowId,
  products,
}: {
  promotionId: string;
  rowId: string;
  products: ProductOption[];
}) {
  const titleId = useId();
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return products;
    return products.filter(
      (product) =>
        product.title.toLowerCase().includes(needle) ||
        product.slug.toLowerCase().includes(needle),
    );
  }, [products, query]);

  if (products.length === 0) {
    return <p className="text-xs text-muted">Every product is already in this row.</p>;
  }

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  return (
    <form action={addPromotionRowProductsAction} className="space-y-3">
      <input type="hidden" name="promotionId" value={promotionId} />
      <input type="hidden" name="rowId" value={rowId} />
      {selected.map((id) => (
        <input key={id} type="hidden" name="productIds" value={id} />
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
        >
          {selected.length > 0
            ? `${selected.length} ${selected.length === 1 ? "product" : "products"} selected`
            : "Choose products"}
        </Button>
        <Button type="submit" size="sm" disabled={selected.length === 0}>
          Add selected
        </Button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-lg rounded-xl border border-line bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              <h3 id={titleId} className="text-sm font-semibold">
                Choose products
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-muted hover:text-ink"
              >
                Close
              </button>
            </div>

            <div className="border-b border-line px-5 py-3">
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or slug"
                aria-label="Search products"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              />
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted">
                  No products match that search.
                </p>
              ) : (
                filtered.map((product) => (
                  <label
                    key={product.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-page"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(product.id)}
                      onChange={() => toggle(product.id)}
                      className="size-4"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{product.title}</span>
                      <span className="block truncate text-xs text-muted">
                        /{product.slug}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-page px-2 py-0.5 text-[10px] font-semibold uppercase text-muted">
                      {product.status}
                    </span>
                  </label>
                ))
              )}
            </div>

            <div className="flex justify-end border-t border-line px-5 py-3">
              <Button type="button" size="sm" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
