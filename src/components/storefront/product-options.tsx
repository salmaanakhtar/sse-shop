"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { addToCartAction } from "@/app/(storefront)/cart-actions";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  buildVariantTree,
  firstAvailableLeaf,
  firstLeaf,
  pathToNode,
  type VariantNodeView,
  type VariantTreeNode,
} from "@/lib/variants";

type OptionGroup = {
  id: string;
  name: string;
  values: { id: string; value: string }[];
};

type Props = {
  options: OptionGroup[];
  nodes: VariantNodeView[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
};

export function ProductOptions({ options, nodes, selectedIds, onSelectedIdsChange }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const tree = useMemo(() => buildVariantTree(nodes), [nodes]);
  const path = selectedIds.length
    ? pathToNode(tree, selectedIds[selectedIds.length - 1] ?? "")
    : [];
  const selectedNode = path[path.length - 1];
  const variant = selectedNode?.variant ?? null;
  const soldOut = !variant || !variant.active || !selectedNode?.active || variant.stockQty === 0;

  const groups: { level: OptionGroup; siblings: VariantTreeNode[]; selectedId?: string }[] = [];
  let parent: VariantTreeNode | undefined;
  for (let depth = 0; depth < options.length; depth += 1) {
    const siblings = (parent ? parent.children : tree).filter((node) => node.active);
    if (siblings.length === 0) break;

    const selected = path[depth];
    const level = options[depth];
    if (!level) break;
    groups.push({ level, siblings, selectedId: selected?.id });
    parent = selected;
    if (!parent || parent.children.length === 0) break;
  }

  const selectedLabel =
    options.length > 0 ? path.map((node) => node.label).join(" / ") : "";
  const statusText = !variant
    ? "Not available in this combination"
    : !variant.active || variant.stockQty === 0
      ? "Sold out"
      : `${variant.stockQty} in stock`;

  function choose(node: VariantTreeNode) {
    const leaf = firstAvailableLeaf(node) ?? firstLeaf(node) ?? node;
    const next = pathToNode(tree, leaf.id).map((item) => item.id);
    onSelectedIdsChange(next.length > 0 ? next : [node.id]);
    setMessage(null);
  }

  function add() {
    if (!variant) return;
    setMessage(null);
    startTransition(async () => {
      const result = await addToCartAction(variant.id, 1);
      if (result.ok) {
        setMessage({ kind: "ok", text: "Added to cart." });
        router.refresh();
      } else {
        setMessage({ kind: "error", text: result.error });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {groups.map(({ level, siblings, selectedId }) => (
          <fieldset key={level.id}>
            <legend className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
              {level.name}
            </legend>
            <div className="flex flex-wrap gap-2">
              {siblings.map((node) => {
                const active = node.id === selectedId;
                const available = firstAvailableLeaf(node) !== null;

                return (
                  <button
                    key={node.id}
                    type="button"
                    aria-pressed={active}
                    disabled={!active && !available}
                    title={!active && !available ? "Not available with this selection" : undefined}
                    onClick={() => choose(node)}
                    className={cn(
                      "h-9 rounded-lg border px-3 text-sm transition-colors",
                      active
                        ? "border-ink bg-ink text-white"
                        : available
                          ? "border-line bg-surface text-ink hover:border-ink/40"
                          : "cursor-not-allowed border-line bg-page text-muted line-through",
                    )}
                  >
                    {node.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      {selectedLabel ? <p className="text-xs text-muted">Selected: {selectedLabel}</p> : null}

      <div className="flex items-baseline justify-between gap-4 border-t border-line pt-5">
        <div>
          <p className="text-xl font-semibold tabular-nums">
            {variant ? formatMoney(variant.priceMinor) : "—"}
          </p>
          <p className="mt-1 text-xs text-muted">{statusText}</p>
        </div>
        <p className="text-xs text-muted">VAT included</p>
      </div>

      <div className="space-y-3">
        <Button
          onClick={add}
          disabled={pending || soldOut}
          className="w-full"
          data-testid="add-to-cart"
        >
          {soldOut ? "Sold out" : pending ? "Adding…" : "Add to cart"}
        </Button>

        {message ? (
          <p
            role="status"
            className={cn(
              "text-sm",
              message.kind === "ok" ? "text-emerald-700" : "text-red-600",
            )}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
