"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { addPromotionRowAction } from "@/server/actions/admin-promotions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import type { PromotionRowKind } from "@/lib/promotions";
import type { PromotionRowOptions } from "@/server/services/promotions";

type ProductOption = PromotionRowOptions["products"][number];

const KIND_LABEL: Record<PromotionRowKind, string> = {
  category: "Category",
  collection: "Collection",
  products: "Products",
};

export function PromotionRowForm({
  promotionId,
  options,
  usedCategoryIds,
  usedCollectionIds,
}: {
  promotionId: string;
  options: PromotionRowOptions;
  usedCategoryIds: string[];
  usedCollectionIds: string[];
}) {
  const dialogTitleId = useId();
  const [kind, setKind] = useState<PromotionRowKind>("category");
  const [sourceId, setSourceId] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [productIds, setProductIds] = useState<string[]>([]);
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

  const usedCategories = new Set(usedCategoryIds);
  const usedCollections = new Set(usedCollectionIds);
  const selectedProducts = productIds
    .map((id) => options.products.find((product) => product.id === id))
    .filter((product): product is ProductOption => Boolean(product));

  const filteredProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options.products;
    return options.products.filter(
      (product) =>
        product.title.toLowerCase().includes(needle) ||
        product.slug.toLowerCase().includes(needle),
    );
  }, [options.products, query]);

  function chooseKind(next: PromotionRowKind) {
    setKind(next);
    setSourceId("");
    setTitle("");
    setTitleTouched(false);
    setProductIds([]);
    setOpen(false);
    setQuery("");
  }

  function chooseCategory(id: string) {
    setSourceId(id);
    if (!titleTouched) {
      setTitle(options.categories.find((category) => category.id === id)?.name ?? "");
    }
  }

  function chooseCollection(id: string) {
    setSourceId(id);
    if (!titleTouched) {
      setTitle(options.collections.find((collection) => collection.id === id)?.name ?? "");
    }
  }

  function toggleProduct(id: string) {
    setProductIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  const categories = options.categories.filter(
    (category) => !usedCategories.has(category.id),
  );
  const collections = options.collections.filter(
    (collection) => !usedCollections.has(collection.id),
  );

  return (
    <form action={addPromotionRowAction} className="space-y-4">
      <input type="hidden" name="promotionId" value={promotionId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="title" value={title} />
      {kind === "category" || kind === "collection" ? (
        <input type="hidden" name="sourceId" value={sourceId} />
      ) : null}
      {kind === "products"
        ? productIds.map((id) => (
            <input key={id} type="hidden" name="productIds" value={id} />
          ))
        : null}

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Row type</p>
        <div className="flex flex-wrap gap-2">
          {(["category", "collection", "products"] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={kind === item}
              onClick={() => chooseKind(item)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                kind === item
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              {KIND_LABEL[item]}
            </button>
          ))}
        </div>
      </div>

      {kind === "category" ? (
        <div>
          <Label htmlFor="row-category">Category</Label>
          <select
            id="row-category"
            value={sourceId}
            onChange={(event) => chooseCategory(event.target.value)}
            required
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Choose a category
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {"— ".repeat(category.depth)}
                {category.name}
                {category.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-muted">
            Includes products in child categories. Each category can be added once.
          </p>
        </div>
      ) : null}

      {kind === "collection" ? (
        <div>
          <Label htmlFor="row-collection">Collection</Label>
          <select
            id="row-collection"
            value={sourceId}
            onChange={(event) => chooseCollection(event.target.value)}
            required
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Choose a collection
            </option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
                {collection.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-muted">
            Keeps the collection&apos;s product order. Each collection can be added once.
          </p>
        </div>
      ) : null}

      {kind === "products" ? (
        <div>
          <Label>Products</Label>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-left text-sm hover:border-brand/40"
          >
            <span className={productIds.length > 0 ? "text-ink" : "text-muted"}>
              {productIds.length > 0
                ? `${productIds.length} ${productIds.length === 1 ? "product" : "products"} selected`
                : "Choose products"}
            </span>
            <span className="text-xs text-muted">Browse</span>
          </button>

          {selectedProducts.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedProducts.map((product) => (
                <span
                  key={product.id}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-page px-2.5 py-1 text-xs"
                >
                  {product.title}
                  <button
                    type="button"
                    onClick={() => toggleProduct(product.id)}
                    aria-label={`Remove ${product.title}`}
                    className="text-muted hover:text-red-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <Label htmlFor="row-title">New row heading</Label>
        <Input
          id="row-title"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setTitleTouched(true);
          }}
          required
          maxLength={80}
          placeholder={kind === "products" ? "Editor's picks" : "Defaults to the source name"}
        />
      </div>

      <Button type="submit" size="sm">
        Add row
      </Button>

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
            aria-labelledby={dialogTitleId}
            className="w-full max-w-lg rounded-xl border border-line bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              <h3 id={dialogTitleId} className="text-sm font-semibold">
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
              {filteredProducts.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted">
                  No products match that search.
                </p>
              ) : (
                filteredProducts.map((product) => (
                  <label
                    key={product.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-page"
                  >
                    <input
                      type="checkbox"
                      checked={productIds.includes(product.id)}
                      onChange={() => toggleProduct(product.id)}
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
