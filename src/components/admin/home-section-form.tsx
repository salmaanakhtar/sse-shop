"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import type { HomeSectionKind } from "@/server/services/home-sections";
import type { PromotionRowOptions } from "@/server/services/promotions";

const KINDS: { value: HomeSectionKind; label: string }[] = [
  { value: "hero", label: "Hero" },
  { value: "promotions", label: "Promotion carousel" },
  { value: "collection", label: "Collection row" },
  { value: "category", label: "Category row" },
  { value: "text", label: "Text block" },
  { value: "products", label: "Hand-picked products" },
  { value: "allProducts", label: "All products grid" },
];

export type HomeSectionFormValues = {
  id?: string;
  kind?: string;
  title?: string;
  body?: string;
  config?: unknown;
  active?: boolean;
};

function configValue(config: unknown, key: string): string {
  if (!config || typeof config !== "object") return "";
  const value = (config as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function configLimit(config: unknown): number {
  if (!config || typeof config !== "object") return 8;
  const value = (config as Record<string, unknown>).limit;
  return typeof value === "number" && Number.isInteger(value) ? value : 8;
}

function configProductIds(config: unknown): string[] {
  if (!config || typeof config !== "object") return [];
  const value = (config as Record<string, unknown>).productIds;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function HomeSectionForm({
  action,
  options,
  values,
  submitLabel,
  error,
}: {
  action: (formData: FormData) => void | Promise<void>;
  options: PromotionRowOptions;
  values?: HomeSectionFormValues;
  submitLabel: string;
  error?: string;
}) {
  const initialKind = (values?.kind as HomeSectionKind | undefined) ?? "hero";
  const [kind, setKind] = useState<HomeSectionKind>(initialKind);
  const showSource = kind === "collection" || kind === "category";
  const showProducts = kind === "products";
  const showLimit = ["collection", "category", "products", "allProducts"].includes(kind);
  const showBody = ["hero", "text", "collection", "category"].includes(kind);

  return (
    <form action={action} className="space-y-4">
      {values?.id ? <input type="hidden" name="id" value={values.id} /> : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`section-kind-${values?.id ?? "new"}`}>Section type</Label>
          <select
            id={`section-kind-${values?.id ?? "new"}`}
            name="kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as HomeSectionKind)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          >
            {KINDS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`section-title-${values?.id ?? "new"}`}>Heading</Label>
          <Input
            id={`section-title-${values?.id ?? "new"}`}
            name="title"
            maxLength={120}
            defaultValue={values?.title ?? ""}
            placeholder={kind === "hero" ? "Considered goods, delivered across the UAE." : ""}
          />
        </div>
      </div>

      {showBody ? (
        <div>
          <Label htmlFor={`section-body-${values?.id ?? "new"}`}>Body</Label>
          <Textarea
            id={`section-body-${values?.id ?? "new"}`}
            name="body"
            rows={3}
            maxLength={2_000}
            defaultValue={values?.body ?? ""}
          />
        </div>
      ) : null}

      {showSource ? (
        <div>
          <Label htmlFor={`section-source-${values?.id ?? "new"}`}>
            {kind === "collection" ? "Collection" : "Category"}
          </Label>
          <select
            id={`section-source-${values?.id ?? "new"}`}
            name="sourceId"
            defaultValue={
              kind === "collection"
                ? configValue(values?.config, "collectionId")
                : configValue(values?.config, "categoryId")
            }
            required
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Choose a {kind}
            </option>
            {kind === "collection"
              ? options.collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                    {collection.active ? "" : " (inactive)"}
                  </option>
                ))
              : options.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {"— ".repeat(category.depth)}
                    {category.name}
                    {category.active ? "" : " (inactive)"}
                  </option>
                ))}
          </select>
        </div>
      ) : null}

      {showProducts ? (
        <div>
          <Label htmlFor={`section-products-${values?.id ?? "new"}`}>Products</Label>
          <select
            id={`section-products-${values?.id ?? "new"}`}
            name="productIds"
            multiple
            size={7}
            defaultValue={configProductIds(values?.config)}
            required
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          >
            {options.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title} ({product.status})
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-muted">Hold Ctrl/Cmd to choose several.</p>
        </div>
      ) : null}

      {showLimit ? (
        <div className="max-w-40">
          <Label htmlFor={`section-limit-${values?.id ?? "new"}`}>Product limit</Label>
          <Input
            id={`section-limit-${values?.id ?? "new"}`}
            name="limit"
            type="number"
            min={1}
            max={24}
            defaultValue={configLimit(values?.config)}
          />
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={values?.active ?? true}
          className="size-4"
        />
        Active on the homepage
      </label>

      <Button type="submit" size="sm">
        {submitLabel}
      </Button>
    </form>
  );
}
