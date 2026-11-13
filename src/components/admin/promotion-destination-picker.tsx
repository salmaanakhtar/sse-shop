"use client";

import { useEffect, useMemo, useState } from "react";
import {
  isPromotionTargetType,
  PROMOTION_TARGET_TYPES,
  promotionTargetPath,
  type PromotionTargetType,
} from "@/lib/promotions";

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  depth: number;
};

type CollectionOption = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
};

type ProductOption = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "active" | "archived";
};

export type PromotionTargetOptions = {
  categories: CategoryOption[];
  collections: CollectionOption[];
  products: ProductOption[];
};

const TARGET_LABEL: Record<PromotionTargetType, string> = {
  category: "Category",
  collection: "Collection",
  product: "Product",
};

export function PromotionDestinationPicker({
  targets,
  defaultType,
  defaultTargetId,
}: {
  targets: PromotionTargetOptions;
  defaultType: string;
  defaultTargetId: string | null;
}) {
  const initialType = isPromotionTargetType(defaultType) ? defaultType : "category";
  const [type, setType] = useState<PromotionTargetType>(initialType);
  const [targetId, setTargetId] = useState(defaultTargetId ?? "");
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

  const selectedProduct = targets.products.find((product) => product.id === targetId);
  const selectedCategory = targets.categories.find((category) => category.id === targetId);
  const selectedCollection = targets.collections.find(
    (collection) => collection.id === targetId,
  );

  const selectedSlug =
    type === "product"
      ? selectedProduct?.slug
      : type === "category"
        ? selectedCategory?.slug
        : selectedCollection?.slug;

  const filteredProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return targets.products;
    return targets.products.filter(
      (product) =>
        product.title.toLowerCase().includes(needle) ||
        product.slug.toLowerCase().includes(needle),
    );
  }, [query, targets.products]);

  function chooseType(next: PromotionTargetType) {
    setType(next);
    setTargetId("");
  }

  function chooseProduct(product: ProductOption) {
    setTargetId(product.id);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="space-y-3 border-t border-line pt-5">
      <input type="hidden" name="targetType" value={type} />
      <input type="hidden" name="targetId" value={targetId} />

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
          Destination
        </p>
        <div className="flex flex-wrap gap-2">
          {PROMOTION_TARGET_TYPES.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={type === item}
              onClick={() => chooseType(item)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                type === item
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              {TARGET_LABEL[item]}
            </button>
          ))}
        </div>
      </div>

      {type === "category" ? (
        <div>
          <label
            htmlFor="promotion-target-category"
            className="mb-1.5 block text-xs font-semibold tracking-wide text-muted uppercase"
          >
            Category
          </label>
          <select
            id="promotion-target-category"
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            required
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Choose a category
            </option>
            {targets.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {"— ".repeat(category.depth)}
                {category.name}
                {category.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {type === "collection" ? (
        <div>
          <label
            htmlFor="promotion-target-collection"
            className="mb-1.5 block text-xs font-semibold tracking-wide text-muted uppercase"
          >
            Collection
          </label>
          <select
            id="promotion-target-collection"
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            required
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Choose a collection
            </option>
            {targets.collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
                {collection.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {type === "product" ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
            Product
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-left text-sm hover:border-brand/40"
          >
            <span className={selectedProduct ? "text-ink" : "text-muted"}>
              {selectedProduct ? selectedProduct.title : "Choose a product"}
            </span>
            <span className="text-xs text-muted">
              {selectedProduct ? `/${selectedProduct.slug}` : "Browse"}
            </span>
          </button>
        </div>
      ) : null}

      {selectedSlug ? (
        <p className="text-xs text-muted">
          Links to <span className="text-ink">{promotionTargetPath(type, selectedSlug)}</span>
        </p>
      ) : null}

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
            aria-labelledby="product-picker-title"
            className="w-full max-w-lg rounded-xl border border-line bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              <h3 id="product-picker-title" className="text-sm font-semibold">
                Choose a product
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
              {filteredProducts.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted">
                  No products match that search.
                </p>
              ) : (
                filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => chooseProduct(product)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-page"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{product.title}</span>
                      <span className="block truncate text-xs text-muted">
                        /{product.slug}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-page px-2 py-0.5 text-[10px] font-semibold uppercase text-muted">
                      {product.status}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
