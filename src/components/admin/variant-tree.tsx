"use client";

import Image from "next/image";
import { Fragment, useMemo, useState } from "react";
import {
  addVariantBranchesAction,
  bulkUpdateVariantsAction,
  copyVariantChildrenAction,
  createDefaultVariantAction,
  createLeafVariantAction,
  deleteNodeImageAction,
  deleteVariantNodeAction,
  updateVariantAction,
  updateVariantNodeAction,
  updateVariantSaleAction,
  uploadNodeImageAction,
} from "@/server/actions/admin-products";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input, Label } from "@/components/ui/field";
import { formatDubaiDateTimeInput } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { activeSalePrice, discountPercent } from "@/lib/sale";
import {
  buildVariantTree,
  effectiveImageKey,
  flattenVariantTree,
  pathToNode,
  type VariantNodeView,
  type VariantTreeNode,
} from "@/lib/variants";

type Level = {
  id: string;
  name: string;
  values: { id: string; value: string }[];
};

function moneyInput(minor: number | null | undefined): string {
  return minor === null || minor === undefined ? "" : (minor / 100).toFixed(2);
}

function pathLabels(tree: VariantTreeNode[], node: VariantTreeNode): string[] {
  return pathToNode(tree, node.id).map((item) => item.label);
}

function StatusBadge({ status }: { status: "Active" | "Inactive" | "Sold out" | "Empty" }) {
  const style =
    status === "Active"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Sold out"
        ? "bg-amber-50 text-amber-700"
        : "bg-zinc-100 text-zinc-600";

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${style}`}>
      {status}
    </span>
  );
}

function ValueCheckboxes({
  values,
  resetKey,
}: {
  values: { id: string; value: string }[];
  resetKey: string;
}) {
  return (
    <div key={resetKey} className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
      {values.map((value) => (
        <label key={value.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            name="optionValueIds"
            value={value.id}
            defaultChecked
            className="size-4"
          />
          {value.value}
        </label>
      ))}
    </div>
  );
}

function TreeRows({
  nodes,
  depth,
  expanded,
  onToggle,
  selectedId,
  onSelect,
  tree,
  allowedIds,
  selectedLeafIds,
  onToggleLeaf,
}: {
  nodes: VariantTreeNode[];
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  tree: VariantTreeNode[];
  allowedIds: Set<string> | null;
  selectedLeafIds: Set<string>;
  onToggleLeaf: (variantId: string) => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        if (allowedIds && !allowedIds.has(node.id)) return null;

        const path = pathToNode(tree, node.id);
        const labels = path.map((item) => item.label);
        const isGroup = node.children.length > 0;
        const variant = node.variant;
        const imageKey = effectiveImageKey(path);
        const salePrice = variant ? activeSalePrice(variant.priceMinor, variant) : null;
        const percent =
          variant && salePrice !== null ? discountPercent(variant.priceMinor, salePrice) : null;
        const status: "Active" | "Inactive" | "Sold out" | "Empty" = isGroup
          ? node.active
            ? "Active"
            : "Inactive"
          : !variant
            ? "Empty"
            : !node.active || !variant.active
              ? "Inactive"
              : variant.stockQty === 0
                ? "Sold out"
                : "Active";

        return (
          <Fragment key={node.id}>
            <tr
              className={`border-b border-line last:border-0 ${
                selectedId === node.id ? "bg-brand-soft/40" : "hover:bg-page/60"
              }`}
            >
              <td className="w-10 px-4 py-3">
                {variant ? (
                  <input
                    type="checkbox"
                    aria-label={`Select ${labels.join(" / ")}`}
                    checked={selectedLeafIds.has(variant.id)}
                    onChange={() => onToggleLeaf(variant.id)}
                    className="size-4"
                  />
                ) : null}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-start" style={{ paddingLeft: depth * 18 }}>
                  {isGroup ? (
                    <button
                      type="button"
                      onClick={() => onToggle(node.id)}
                      aria-label={expanded.has(node.id) ? `Collapse ${node.label}` : `Expand ${node.label}`}
                      className="mr-1 flex size-5 shrink-0 items-center justify-center rounded text-muted hover:bg-page hover:text-ink"
                    >
                      {expanded.has(node.id) ? "▾" : "▸"}
                    </button>
                  ) : (
                    <span className="mr-1 inline-block w-5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium">{node.label}</p>
                    <p className="truncate text-[11px] text-muted">{labels.join(" / ")}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-muted">
                {isGroup ? "Group" : variant ? "Variant" : "Empty"}
              </td>
              <td className="px-4 py-3 text-xs text-muted">{variant?.sku ?? "—"}</td>
              <td className="px-4 py-3 text-sm tabular-nums">
                {variant ? formatMoney(salePrice ?? variant.priceMinor) : "—"}
                {salePrice !== null && percent !== null ? (
                  <p className="text-[10px] text-muted">
                    was {formatMoney(variant!.priceMinor)} · −{percent}%
                  </p>
                ) : null}
              </td>
              <td className="px-4 py-3 text-sm tabular-nums">{variant?.stockQty ?? "—"}</td>
              <td className="px-4 py-3">
                <StatusBadge status={status} />
              </td>
              <td className="px-4 py-3">
                {imageKey ? (
                  <Image
                    src={`/media/${imageKey}`}
                    alt={node.label}
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded-md border border-line object-cover"
                  />
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onSelect(node.id)}
                  className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
                >
                  Edit
                </button>
              </td>
            </tr>

            {isGroup && expanded.has(node.id) ? (
              <TreeRows
                nodes={node.children}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
                selectedId={selectedId}
                onSelect={onSelect}
                tree={tree}
                allowedIds={allowedIds}
                selectedLeafIds={selectedLeafIds}
                onToggleLeaf={onToggleLeaf}
              />
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}

function BranchImageForm({
  productId,
  node,
}: {
  productId: string;
  node: VariantTreeNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {node.imageKey ? (
          <Image
            src={`/media/${node.imageKey}`}
            alt={node.imageAlt || node.label}
            width={72}
            height={72}
            className="h-16 w-16 rounded-lg border border-line object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-line text-[11px] text-muted">
            No image
          </div>
        )}
        {node.imageKey ? (
          <form action={deleteNodeImageAction}>
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="nodeId" value={node.id} />
            <ConfirmSubmitButton
              type="submit"
              message="Remove this branch image?"
              className="text-xs text-muted hover:text-red-600"
            >
              Remove image
            </ConfirmSubmitButton>
          </form>
        ) : null}
      </div>

      <form action={uploadNodeImageAction} className="space-y-2">
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="nodeId" value={node.id} />
        <input
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          required
          className="block w-full text-xs file:mr-2 file:rounded-md file:border file:border-line file:bg-page file:px-2 file:py-1"
        />
        <div>
          <Label htmlFor={`inspector-alt-${node.id}`}>Alt text</Label>
          <Input id={`inspector-alt-${node.id}`} name="alt" placeholder={node.label} />
        </div>
        <Button type="submit" size="sm" variant="secondary">
          Upload image
        </Button>
      </form>
    </div>
  );
}

function BranchInspector({
  productId,
  node,
  tree,
  levels,
  levelIndexById,
  siblings,
  onAddChildren,
  onClose,
}: {
  productId: string;
  node: VariantTreeNode;
  tree: VariantTreeNode[];
  levels: Level[];
  levelIndexById: Map<string, number>;
  siblings: VariantTreeNode[];
  onAddChildren: (id: string) => void;
  onClose: () => void;
}) {
  const path = pathToNode(tree, node.id);
  const levelIndex = node.optionId ? (levelIndexById.get(node.optionId) ?? -1) : -1;
  const nextLevel = levelIndex >= 0 ? levels[levelIndex + 1] : undefined;
  const isGroup = node.children.length > 0;
  const copySources = siblings.filter(
    (sibling) => sibling.id !== node.id && sibling.children.length > 0,
  );

  return (
    <aside className="h-fit rounded-xl border border-line bg-surface p-5 xl:sticky xl:top-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
            {isGroup ? "Group" : node.variant ? "Variant" : "Branch"}
          </p>
          <h3 className="mt-1 text-base font-semibold">{node.label}</h3>
          <p className="mt-0.5 text-[11px] text-muted">{path.map((item) => item.label).join(" / ")}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Close
        </button>
      </div>

      {isGroup ? (
        <div className="mt-5 space-y-5">
          <form action={updateVariantNodeAction} className="space-y-3">
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="nodeId" value={node.id} />
            <div>
              <Label htmlFor={`inspector-default-price-${node.id}`}>Default price</Label>
              <Input
                id={`inspector-default-price-${node.id}`}
                name="defaultPrice"
                inputMode="decimal"
                placeholder="120.00"
                defaultValue={moneyInput(node.defaultPriceMinor)}
              />
            </div>
            <div>
              <Label htmlFor={`inspector-default-stock-${node.id}`}>Default stock</Label>
              <Input
                id={`inspector-default-stock-${node.id}`}
                name="defaultStock"
                type="number"
                min={0}
                defaultValue={node.defaultStockQty ?? ""}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={node.active} className="size-4" />
              Active branch
            </label>
            <Button type="submit" size="sm" variant="secondary">
              Save branch
            </Button>
          </form>

          <div className="border-t border-line pt-4">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onAddChildren(node.id)}
            >
              Add children
            </Button>
          </div>

          {copySources.length > 0 ? (
            <form action={copyVariantChildrenAction} className="space-y-2 border-t border-line pt-4">
              <input type="hidden" name="productId" value={productId} />
              <input type="hidden" name="targetNodeId" value={node.id} />
              <Label htmlFor={`inspector-copy-${node.id}`}>Copy children from</Label>
              <select
                id={`inspector-copy-${node.id}`}
                name="sourceNodeId"
                required
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              >
                <option value="">Choose a sibling</option>
                {copySources.map((sibling) => (
                  <option key={sibling.id} value={sibling.id}>
                    {sibling.label}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm" variant="secondary">
                Copy children
              </Button>
            </form>
          ) : null}
        </div>
      ) : node.variant ? (
        <form action={updateVariantAction} className="mt-5 space-y-3">
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="variantId" value={node.variant.id} />
          <div>
            <Label htmlFor={`inspector-title-${node.variant.id}`}>Order title</Label>
            <Input
              id={`inspector-title-${node.variant.id}`}
              name="title"
              defaultValue={node.variant.title}
            />
          </div>
          <div>
            <Label htmlFor={`inspector-sku-${node.variant.id}`}>SKU</Label>
            <Input
              id={`inspector-sku-${node.variant.id}`}
              name="sku"
              defaultValue={node.variant.sku}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`inspector-price-${node.variant.id}`}>Price (AED)</Label>
              <Input
                id={`inspector-price-${node.variant.id}`}
                name="price"
                inputMode="decimal"
                defaultValue={(node.variant.priceMinor / 100).toFixed(2)}
                data-testid="variant-price"
              />
            </div>
            <div>
              <Label htmlFor={`inspector-stock-${node.variant.id}`}>Stock</Label>
              <Input
                id={`inspector-stock-${node.variant.id}`}
                name="stock"
                type="number"
                min={0}
                defaultValue={node.variant.stockQty}
              />
            </div>
          </div>
          <div>
            <Label htmlFor={`inspector-weight-${node.variant.id}`}>Weight (grams)</Label>
            <Input
              id={`inspector-weight-${node.variant.id}`}
              name="weightGrams"
              type="number"
              min={0}
              placeholder="e.g. 250"
              defaultValue={node.variant.weightGrams ?? ""}
              data-testid="variant-weight"
            />
            <p className="mt-1 text-[11px] text-muted">
              Used for emirate weight bands. Blank ships in the lightest band.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={node.variant.active && node.active}
              className="size-4"
            />
            Active
          </label>
          <Button type="submit" size="sm" variant="secondary" data-testid="variant-save">
            Save variant
          </Button>
        </form>
      ) : nextLevel ? (
        <p className="mt-5 rounded-lg bg-page px-3 py-3 text-sm text-muted">
          This branch has no children yet. Use Add children above to build it.
        </p>
      ) : (
        <form action={createLeafVariantAction} className="mt-5 space-y-3">
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="nodeId" value={node.id} />
          <div>
            <Label htmlFor={`inspector-leaf-price-${node.id}`}>Price (AED)</Label>
            <Input
              id={`inspector-leaf-price-${node.id}`}
              name="price"
              inputMode="decimal"
              placeholder="120.00"
              required
              defaultValue={moneyInput(node.defaultPriceMinor)}
            />
          </div>
          <div>
            <Label htmlFor={`inspector-leaf-stock-${node.id}`}>Stock</Label>
            <Input
              id={`inspector-leaf-stock-${node.id}`}
              name="stock"
              type="number"
              min={0}
              required
              defaultValue={node.defaultStockQty ?? 10}
            />
          </div>
          <div>
            <Label htmlFor={`inspector-leaf-weight-${node.id}`}>Weight (grams)</Label>
            <Input
              id={`inspector-leaf-weight-${node.id}`}
              name="weightGrams"
              type="number"
              min={0}
              placeholder="e.g. 250"
            />
          </div>
          <div>
            <Label htmlFor={`inspector-leaf-sku-${node.id}`}>SKU (optional)</Label>
            <Input id={`inspector-leaf-sku-${node.id}`} name="sku" placeholder="Auto from path" />
          </div>
          <Button type="submit" size="sm" variant="secondary">
            Create variant
          </Button>
        </form>
      )}

      {node.variant ? (
        <form
          action={updateVariantSaleAction}
          className="mt-5 space-y-3 border-t border-line pt-4"
        >
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="variantId" value={node.variant.id} />
          <div>
            <p className="text-sm font-semibold">Sale</p>
            <p className="mt-1 text-[11px] text-muted">
              Times are Asia/Dubai. Leave the sale price blank to clear it.
            </p>
          </div>
          <div>
            <Label htmlFor={`sale-price-${node.variant.id}`}>Sale price (AED)</Label>
            <Input
              id={`sale-price-${node.variant.id}`}
              name="salePrice"
              inputMode="decimal"
              placeholder="No sale"
              defaultValue={moneyInput(node.variant.salePriceMinor)}
              data-testid="sale-price"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`sale-start-${node.variant.id}`}>Starts</Label>
              <Input
                id={`sale-start-${node.variant.id}`}
                name="saleStartsAt"
                type="datetime-local"
                defaultValue={formatDubaiDateTimeInput(node.variant.saleStartsAt)}
              />
            </div>
            <div>
              <Label htmlFor={`sale-end-${node.variant.id}`}>Ends</Label>
              <Input
                id={`sale-end-${node.variant.id}`}
                name="saleEndsAt"
                type="datetime-local"
                defaultValue={formatDubaiDateTimeInput(node.variant.saleEndsAt)}
              />
            </div>
          </div>
          <Button type="submit" size="sm" variant="secondary">
            Save sale
          </Button>
        </form>
      ) : null}

      <div className="mt-5 border-t border-line pt-4">
        <BranchImageForm productId={productId} node={node} />
      </div>

      <form action={deleteVariantNodeAction} className="mt-5 border-t border-line pt-4">
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="nodeId" value={node.id} />
        <ConfirmSubmitButton
          type="submit"
          message={`Delete ${path.map((item) => item.label).join(" / ")} and all its children?`}
          className="text-xs text-muted underline-offset-4 hover:text-red-600 hover:underline"
        >
          Delete branch
        </ConfirmSubmitButton>
      </form>
    </aside>
  );
}

export function VariantTreeEditor({
  productId,
  levels,
  nodes,
}: {
  productId: string;
  levels: Level[];
  nodes: VariantNodeView[];
}) {
  const tree = useMemo(() => buildVariantTree(nodes), [nodes]);
  const all = useMemo(() => flattenVariantTree(tree), [tree]);
  const levelIndexById = useMemo(
    () => new Map(levels.map((level, index) => [level.id, index])),
    [levels],
  );

  const groups = all.filter((node) => node.children.length > 0);
  const leaves = all.filter((node) => node.children.length === 0);
  const sellable = leaves.filter((node) => node.variant);
  const activeInStock = sellable.filter(
    (node) => node.active && node.variant?.active && (node.variant?.stockQty ?? 0) > 0,
  );

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(groups.map((node) => node.id)),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addParentId, setAddParentId] = useState<string>(() => {
    const firstLevel = levels[0];
    const rootsUsed = new Set(tree.map((node) => node.optionValueId));
    const rootAvailable = firstLevel?.values.some((value) => !rootsUsed.has(value.id));
    if (rootAvailable) return "";

    const candidate = all.find((node) => {
      const index = node.optionId ? (levelIndexById.get(node.optionId) ?? -1) : -1;
      return !node.variant && index >= 0 && index < levels.length - 1;
    });
    return candidate?.id ?? "";
  });
  const [selectedLeafIds, setSelectedLeafIds] = useState<Set<string>>(() => new Set());
  const [onlyMissingImages, setOnlyMissingImages] = useState(false);

  const missingImageLeaves = leaves.filter(
    (leaf) => !effectiveImageKey(pathToNode(tree, leaf.id)),
  );
  const allowedIds = useMemo(() => {
    if (!onlyMissingImages) return null;
    const allowed = new Set<string>();
    for (const leaf of leaves) {
      const path = pathToNode(tree, leaf.id);
      if (effectiveImageKey(path)) continue;
      for (const node of path) allowed.add(node.id);
    }
    return allowed;
  }, [onlyMissingImages, leaves, tree]);
  const visibleLeaves = allowedIds
    ? leaves.filter((leaf) => allowedIds.has(leaf.id))
    : leaves;
  const allVisibleSelected =
    visibleLeaves.length > 0 &&
    visibleLeaves.every((leaf) => leaf.variant && selectedLeafIds.has(leaf.variant.id));

  const selected = selectedId ? (all.find((node) => node.id === selectedId) ?? null) : null;
  const addParent = addParentId ? (all.find((node) => node.id === addParentId) ?? null) : null;
  const addLevelIndex = addParent?.optionId
    ? (levelIndexById.get(addParent.optionId) ?? 0)
    : 0;
  const addNextLevel = addParent ? levels[addLevelIndex + 1] : levels[0];
  const addExisting = addParent ? addParent.children : tree;
  const addAvailableValues = addNextLevel
    ? addNextLevel.values.filter(
        (value) => !addExisting.some((child) => child.optionValueId === value.id),
      )
    : [];
  const addChildrenAreLeaves = addParent
    ? addLevelIndex === levels.length - 2
    : levels.length === 1;

  const parentChoices = all.filter((node) => {
    if (node.variant) return false;
    const index = node.optionId ? (levelIndexById.get(node.optionId) ?? -1) : -1;
    return index >= 0 && index < levels.length - 1;
  });

  const canAddRoot =
    !!levels[0] &&
    levels[0].values.some(
      (value) => !tree.some((node) => node.optionValueId === value.id),
    );
  const addParentOptions = [
    ...(canAddRoot ? [{ id: "", label: `Root — ${levels[0]?.name ?? ""}` }] : []),
    ...parentChoices.map((node) => ({
      id: node.id,
      label: pathLabels(tree, node).join(" / "),
    })),
  ];

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleLeaf(variantId: string) {
    setSelectedLeafIds((current) => {
      const next = new Set(current);
      if (next.has(variantId)) next.delete(variantId);
      else next.add(variantId);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedLeafIds((current) => {
      const next = new Set(current);
      for (const leaf of visibleLeaves) {
        if (!leaf.variant) continue;
        if (allVisibleSelected) next.delete(leaf.variant.id);
        else next.add(leaf.variant.id);
      }
      return next;
    });
  }

  function addChildrenTo(id: string) {
    setAddParentId(id);
    setSelectedId(id);
  }

  if (levels.length === 0 && tree.length === 0) {
    return (
      <form
        action={createDefaultVariantAction}
        className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-4"
      >
        <input type="hidden" name="productId" value={productId} />
        <div className="w-36">
          <Label htmlFor="default-price">Price (AED)</Label>
          <Input
            id="default-price"
            name="price"
            inputMode="decimal"
            placeholder="120.00"
            required
          />
        </div>
        <div className="w-28">
          <Label htmlFor="default-stock">Stock</Label>
          <Input id="default-stock" name="stock" type="number" min={0} placeholder="10" required />
        </div>
        <div className="w-32">
          <Label htmlFor="default-weight">Weight (g)</Label>
          <Input
            id="default-weight"
            name="weightGrams"
            type="number"
            min={0}
            placeholder="250"
          />
        </div>
        <div className="w-44">
          <Label htmlFor="default-sku">SKU (optional)</Label>
          <Input id="default-sku" name="sku" placeholder="Auto from product" />
        </div>
        <Button type="submit" size="sm" variant="secondary">
          Create default variant
        </Button>
      </form>
    );
  }

  return (
    <div className="mt-5 space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-page px-2.5 py-1 text-muted">{levels.length} levels</span>
        <span className="rounded-full bg-page px-2.5 py-1 text-muted">{groups.length} groups</span>
        <span className="rounded-full bg-page px-2.5 py-1 text-muted">{sellable.length} variants</span>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
          {activeInStock.length} active and in stock
        </span>
        <label className="ml-auto flex items-center gap-2 rounded-full bg-page px-2.5 py-1 text-muted">
          <input
            type="checkbox"
            checked={onlyMissingImages}
            onChange={() => {
              setOnlyMissingImages((value) => !value);
              setSelectedLeafIds(new Set());
            }}
            className="size-3.5"
          />
          Missing image ({missingImageLeaves.length})
        </label>
      </div>

      {selectedLeafIds.size > 0 ? (
        <div className="rounded-xl border border-brand/30 bg-brand-soft/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">{selectedLeafIds.size} variants selected</p>
            <button
              type="button"
              onClick={() => setSelectedLeafIds(new Set())}
              className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Clear selection
            </button>
          </div>
          <form action={bulkUpdateVariantsAction} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="productId" value={productId} />
            {[...selectedLeafIds].map((variantId) => (
              <input key={variantId} type="hidden" name="variantIds" value={variantId} />
            ))}
            <div className="w-36">
              <Label htmlFor="bulk-price">Price (AED)</Label>
              <Input id="bulk-price" name="price" inputMode="decimal" placeholder="Leave blank" />
            </div>
            <div className="w-32">
              <Label htmlFor="bulk-stock">Stock</Label>
              <Input id="bulk-stock" name="stock" type="number" min={0} placeholder="Leave blank" />
            </div>
            <Button type="submit" size="sm" variant="secondary">
              Update selected
            </Button>
          </form>
          <p className="mt-2 text-[11px] text-muted">
            Blank fields stay unchanged. This writes the same price or stock to every selected
            variant.
          </p>
        </div>
      ) : null}

      {levels.length > 0 && addParentOptions.length > 0 ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Add branches</h3>
              <p className="mt-1 text-xs text-muted">
                Pick a parent, tick only the values that exist, then add. Children never appear by
                accident.
              </p>
            </div>
          </div>

          <form action={addVariantBranchesAction} className="mt-3 space-y-3">
            <input type="hidden" name="productId" value={productId} />
            <div className="grid gap-3 sm:grid-cols-[minmax(0,18rem)_auto] sm:items-end">
              <div>
                <Label htmlFor="add-parent">Parent</Label>
                <select
                  id="add-parent"
                  name="parentId"
                  value={addParentId}
                  onChange={(event) => setAddParentId(event.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                >
                  {addParentOptions.map((option) => (
                    <option key={option.id || "root"} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted">
                {addNextLevel
                  ? `Adding ${addNextLevel.name.toLowerCase()} values`
                  : "No next level for this parent."}
              </p>
            </div>

            {addAvailableValues.length > 0 ? (
              <>
                <ValueCheckboxes values={addAvailableValues} resetKey={addParentId} />
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-36">
                    <Label htmlFor="add-price">
                      {addChildrenAreLeaves ? "Price (AED)" : "Default price"}
                    </Label>
                    <Input
                      key={`price-${addParentId}`}
                      id="add-price"
                      name="price"
                      inputMode="decimal"
                      placeholder="120.00"
                      defaultValue={moneyInput(addParent?.defaultPriceMinor)}
                    />
                  </div>
                  <div className="w-28">
                    <Label htmlFor="add-stock">
                      {addChildrenAreLeaves ? "Stock" : "Default stock"}
                    </Label>
                    <Input
                      key={`stock-${addParentId}`}
                      id="add-stock"
                      name="stock"
                      type="number"
                      min={0}
                      placeholder={addChildrenAreLeaves ? "10" : ""}
                      defaultValue={addParent?.defaultStockQty ?? ""}
                    />
                  </div>
                  <Button type="submit" size="sm" variant="secondary">
                    Add branches
                  </Button>
                </div>
              </>
            ) : (
              <p className="rounded-lg bg-page px-3 py-2 text-xs text-muted">
                Every {addNextLevel?.name.toLowerCase() ?? "child"} value is already under this
                parent.
              </p>
            )}
          </form>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          {tree.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted">
              No branches yet. Add a root above, then add its children.
            </p>
          ) : allowedIds && visibleLeaves.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted">
              No branches are missing an image. Turn the filter off to see the full tree.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-line text-left text-[11px] tracking-wide text-muted uppercase">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        aria-label="Select all visible variants"
                        className="size-4"
                      />
                    </th>
                    <th className="px-4 py-3 font-semibold">Branch</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">SKU</th>
                    <th className="px-4 py-3 font-semibold">Price</th>
                    <th className="px-4 py-3 font-semibold">Stock</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Image</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  <TreeRows
                    nodes={tree}
                    depth={0}
                    expanded={expanded}
                    onToggle={toggle}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    tree={tree}
                    allowedIds={allowedIds}
                    selectedLeafIds={selectedLeafIds}
                    onToggleLeaf={toggleLeaf}
                  />
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selected ? (
          <BranchInspector
            productId={productId}
            node={selected}
            tree={tree}
            levels={levels}
            levelIndexById={levelIndexById}
            siblings={
              selected.parentId
                ? (all.find((node) => node.id === selected.parentId)?.children ?? [])
                : tree
            }
            onAddChildren={addChildrenTo}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <aside className="h-fit rounded-xl border border-dashed border-line p-5 text-sm text-muted xl:sticky xl:top-6">
            Select a branch to edit its defaults, image, children, or leaf variant.
          </aside>
        )}
      </div>
    </div>
  );
}
