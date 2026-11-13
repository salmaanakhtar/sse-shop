"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { ProductOptions } from "@/components/storefront/product-options";
import {
  buildVariantTree,
  effectiveImageKey,
  firstAvailableLeafInTree,
  firstLeafInTree,
  pathToNode,
} from "@/lib/variants";
import { badgeToneClass } from "@/lib/badges";
import type { ProductDetail } from "@/server/services/catalog";
import type { WishlistStateForProduct } from "@/server/services/wishlists";

export function ProductDetailView({
  product,
  wishlist,
}: {
  product: ProductDetail;
  wishlist: WishlistStateForProduct | null;
}) {
  const tree = useMemo(() => buildVariantTree(product.nodes), [product.nodes]);

  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const leaf = firstAvailableLeafInTree(tree) ?? firstLeafInTree(tree);
    return leaf ? pathToNode(tree, leaf.id).map((node) => node.id) : [];
  });
  const [manualImageKey, setManualImageKey] = useState<string | null>(null);

  const path = selectedIds.length
    ? pathToNode(tree, selectedIds[selectedIds.length - 1] ?? "")
    : [];
  const selectedNode = path[path.length - 1];
  const selectedBranchImage = effectiveImageKey(path);
  const displayImageKey =
    manualImageKey ?? selectedBranchImage ?? product.media[0]?.storageKey ?? null;

  const galleryKeys = [
    ...new Set([
      ...path.map((node) => node.imageKey).filter((key): key is string => Boolean(key)),
      ...product.media.map((media) => media.storageKey),
    ]),
  ];

  function handleSelection(ids: string[]) {
    setSelectedIds(ids);
    setManualImageKey(null);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="grid gap-10 md:grid-cols-2">
        <div className="space-y-4">
          <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-surface">
            {displayImageKey ? (
              <Image
                src={`/media/${displayImageKey}`}
                alt={
                  product.media.find((media) => media.storageKey === displayImageKey)?.alt ||
                  selectedNode?.imageAlt ||
                  product.title
                }
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted">
                No image yet
              </div>
            )}
          </div>

          {galleryKeys.length > 1 ? (
            <div className="grid grid-cols-4 gap-3">
              {galleryKeys.slice(0, 8).map((key) => {
                const media = product.media.find((item) => item.storageKey === key);
                const active = key === displayImageKey;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setManualImageKey(key)}
                    aria-label="Show image"
                    aria-pressed={active}
                    className={`relative aspect-square overflow-hidden rounded-lg border bg-surface ${
                      active ? "border-ink" : "border-line hover:border-ink/40"
                    }`}
                  >
                    <Image
                      src={`/media/${key}`}
                      alt={media?.alt || selectedNode?.imageAlt || product.title}
                      fill
                      sizes="120px"
                      className="object-cover"
                    />
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{product.title}</h1>
          {product.badges.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {product.badges.map((badge) => (
                <span
                  key={badge.id}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase ${badgeToneClass(
                    badge.tone,
                  )}`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          ) : null}
          {product.description ? (
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted">
              {product.description}
            </p>
          ) : null}

          <div className="mt-8">
            <ProductOptions
              options={product.options}
              nodes={product.nodes}
              selectedIds={selectedIds}
              onSelectedIdsChange={handleSelection}
              wishlist={wishlist}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
