import Image from "next/image";
import {
  addVariantBranchesAction,
  copyVariantChildrenAction,
  createDefaultVariantAction,
  createLeafVariantAction,
  deleteNodeImageAction,
  deleteVariantNodeAction,
  updateVariantAction,
  updateVariantNodeAction,
  uploadNodeImageAction,
} from "@/server/actions/admin-products";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input, Label } from "@/components/ui/field";
import { formatMoney } from "@/lib/money";
import {
  buildVariantTree,
  flattenVariantTree,
  type VariantNodeView,
  type VariantTreeNode,
} from "@/lib/variants";

type Level = {
  id: string;
  name: string;
  values: { id: string; value: string }[];
};

function moneyInput(minor: number | null): string {
  return minor === null ? "" : (minor / 100).toFixed(2);
}

function ValueCheckboxes({ values }: { values: { id: string; value: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
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

function NodeCard({
  productId,
  node,
  levels,
  levelIndexById,
  siblings,
  parentPath,
}: {
  productId: string;
  node: VariantTreeNode;
  levels: Level[];
  levelIndexById: Map<string, number>;
  siblings: VariantTreeNode[];
  parentPath: string[];
}) {
  const levelIndex = node.optionId ? (levelIndexById.get(node.optionId) ?? 0) : 0;
  const level = levels[levelIndex];
  const nextLevel = levels[levelIndex + 1];
  const path = [...parentPath, node.label];
  const isGroup = node.children.length > 0;
  const availableChildValues = nextLevel
    ? nextLevel.values.filter(
        (value) => !node.children.some((child) => child.optionValueId === value.id),
      )
    : [];
  const copySources = siblings.filter(
    (sibling) => sibling.id !== node.id && sibling.children.length > 0,
  );
  const childrenAreLeaves = nextLevel ? !levels[levelIndex + 2] : true;

  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
            {level ? `${level.name} · level ${levelIndex + 1}` : "Default"}
          </p>
          <p className="text-sm font-semibold">{node.label}</p>
          <p className="mt-0.5 text-[11px] text-muted">{path.join(" / ")}</p>

          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold tracking-wide uppercase">
            {isGroup ? (
              <span className="rounded-full bg-page px-2 py-0.5 text-muted">Group</span>
            ) : null}
            {node.variant ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                Sellable
              </span>
            ) : null}
            {!isGroup && !node.variant ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                No variant yet
              </span>
            ) : null}
            {!node.active ? (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">Inactive</span>
            ) : null}
          </div>
        </div>

        <form action={deleteVariantNodeAction}>
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="nodeId" value={node.id} />
          <ConfirmSubmitButton
            type="submit"
            message={`Delete ${path.join(" / ")} and all its children?`}
            className="text-xs text-muted underline-offset-4 hover:text-red-600 hover:underline"
          >
            Delete branch
          </ConfirmSubmitButton>
        </form>
      </div>

      <div className="mt-4 flex flex-wrap items-start gap-4 rounded-lg bg-page/60 p-3">
        <div className="flex items-center gap-3">
          {node.imageKey ? (
            <Image
              src={`/media/${node.imageKey}`}
              alt={node.imageAlt || node.label}
              width={80}
              height={80}
              className="h-20 w-20 rounded-lg border border-line object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-line text-[11px] text-muted">
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

        <form
          action={uploadNodeImageAction}
          className="flex flex-wrap items-end gap-2 text-sm"
        >
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="nodeId" value={node.id} />
          <div>
            <Label htmlFor={`node-image-${node.id}`}>Branch image</Label>
            <input
              id={`node-image-${node.id}`}
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              required
              className="block text-xs file:mr-2 file:rounded-md file:border file:border-line file:bg-page file:px-2 file:py-1"
            />
          </div>
          <div className="w-40">
            <Label htmlFor={`node-alt-${node.id}`}>Alt text</Label>
            <Input id={`node-alt-${node.id}`} name="alt" placeholder={node.label} />
          </div>
          <Button type="submit" size="sm" variant="secondary">
            Upload
          </Button>
        </form>
      </div>

      {isGroup ? (
        <form
          action={updateVariantNodeAction}
          className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-line p-3"
        >
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="nodeId" value={node.id} />
          <div className="w-32">
            <Label htmlFor={`node-price-${node.id}`}>Default price</Label>
            <Input
              id={`node-price-${node.id}`}
              name="defaultPrice"
              inputMode="decimal"
              placeholder="120.00"
              defaultValue={moneyInput(node.defaultPriceMinor)}
            />
          </div>
          <div className="w-28">
            <Label htmlFor={`node-stock-${node.id}`}>Default stock</Label>
            <Input
              id={`node-stock-${node.id}`}
              name="defaultStock"
              type="number"
              min={0}
              defaultValue={node.defaultStockQty ?? ""}
            />
          </div>
          <label className="flex h-10 items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={node.active} className="size-4" />
            Active branch
          </label>
          <Button type="submit" size="sm" variant="secondary">
            Save branch
          </Button>
        </form>
      ) : null}

      {!node.variant && nextLevel ? (
        <div className="mt-4 rounded-lg border border-dashed border-line p-3">
          <p className="text-xs font-medium">
            Add {nextLevel.name} values under {node.label}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            Only the values you tick become children of this branch.
          </p>

          {availableChildValues.length > 0 ? (
            <form action={addVariantBranchesAction} className="mt-3 space-y-3">
              <input type="hidden" name="productId" value={productId} />
              <input type="hidden" name="parentId" value={node.id} />
              <ValueCheckboxes values={availableChildValues} />
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-32">
                  <Label htmlFor={`child-price-${node.id}`}>
                    {childrenAreLeaves ? "Price (AED)" : "Default price"}
                  </Label>
                  <Input
                    id={`child-price-${node.id}`}
                    name="price"
                    inputMode="decimal"
                    placeholder="120.00"
                    required={childrenAreLeaves}
                    defaultValue={moneyInput(node.defaultPriceMinor)}
                  />
                </div>
                <div className="w-28">
                  <Label htmlFor={`child-stock-${node.id}`}>
                    {childrenAreLeaves ? "Stock" : "Default stock"}
                  </Label>
                  <Input
                    id={`child-stock-${node.id}`}
                    name="stock"
                    type="number"
                    min={0}
                    placeholder={childrenAreLeaves ? "10" : ""}
                    required={childrenAreLeaves}
                    defaultValue={node.defaultStockQty ?? ""}
                  />
                </div>
                <Button type="submit" size="sm" variant="secondary">
                  Add children
                </Button>
              </div>
            </form>
          ) : (
            <p className="mt-2 text-xs text-muted">
              Every {nextLevel.name} value is already under this branch.
            </p>
          )}
        </div>
      ) : null}

      {!node.variant && !nextLevel ? (
        <form
          action={createLeafVariantAction}
          className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-line p-3"
        >
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="nodeId" value={node.id} />
          <div className="w-32">
            <Label htmlFor={`leaf-price-${node.id}`}>Price (AED)</Label>
            <Input
              id={`leaf-price-${node.id}`}
              name="price"
              inputMode="decimal"
              placeholder="120.00"
              required
              defaultValue={moneyInput(node.defaultPriceMinor)}
            />
          </div>
          <div className="w-28">
            <Label htmlFor={`leaf-stock-${node.id}`}>Stock</Label>
            <Input
              id={`leaf-stock-${node.id}`}
              name="stock"
              type="number"
              min={0}
              required
              defaultValue={node.defaultStockQty ?? 10}
            />
          </div>
          <div className="w-40">
            <Label htmlFor={`leaf-sku-${node.id}`}>SKU (optional)</Label>
            <Input id={`leaf-sku-${node.id}`} name="sku" placeholder="Auto from path" />
          </div>
          <Button type="submit" size="sm" variant="secondary">
            Create variant
          </Button>
        </form>
      ) : null}

      {isGroup && copySources.length > 0 && !node.variant ? (
        <form
          action={copyVariantChildrenAction}
          className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-line p-3"
        >
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="targetNodeId" value={node.id} />
          <div className="w-56">
            <Label htmlFor={`copy-source-${node.id}`}>Copy children from</Label>
            <select
              id={`copy-source-${node.id}`}
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
          </div>
          <Button type="submit" size="sm" variant="secondary">
            Copy children
          </Button>
        </form>
      ) : null}

      {node.variant ? (
        <form
          action={updateVariantAction}
          className="mt-4 grid gap-3 rounded-lg border border-line p-3 lg:grid-cols-[minmax(0,1.4fr)_9rem_9rem_7rem_6rem_auto] lg:items-start"
        >
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="variantId" value={node.variant.id} />
          <div>
            <Label htmlFor={`variant-title-${node.variant.id}`}>Order title</Label>
            <Input
              id={`variant-title-${node.variant.id}`}
              name="title"
              defaultValue={node.variant.title}
            />
            <p className="mt-1 text-[11px] text-muted">Shown on order lines.</p>
          </div>
          <div>
            <Label htmlFor={`variant-sku-${node.variant.id}`}>SKU</Label>
            <Input
              id={`variant-sku-${node.variant.id}`}
              name="sku"
              defaultValue={node.variant.sku}
            />
          </div>
          <div>
            <Label htmlFor={`variant-price-${node.variant.id}`}>Price (AED)</Label>
            <Input
              id={`variant-price-${node.variant.id}`}
              name="price"
              inputMode="decimal"
              defaultValue={(node.variant.priceMinor / 100).toFixed(2)}
              data-testid="variant-price"
            />
            <p className="mt-1 text-[11px] text-muted">
              {formatMoney(node.variant.priceMinor)}
            </p>
          </div>
          <div>
            <Label htmlFor={`variant-stock-${node.variant.id}`}>Stock</Label>
            <Input
              id={`variant-stock-${node.variant.id}`}
              name="stock"
              type="number"
              min={0}
              defaultValue={node.variant.stockQty}
            />
          </div>
          <label className="flex h-10 items-center gap-2 text-sm lg:mt-5">
            <input
              type="checkbox"
              name="active"
              defaultChecked={node.variant.active && node.active}
              className="size-4"
            />
            Active
          </label>
          <div className="lg:mt-5">
            <Button type="submit" size="sm" variant="secondary" data-testid="variant-save">
              Save
            </Button>
          </div>
        </form>
      ) : null}

      {node.children.length > 0 ? (
        <div className="mt-4 space-y-3 border-l-2 border-line pl-4">
          {node.children.map((child) => (
            <NodeCard
              key={child.id}
              productId={productId}
              node={child}
              levels={levels}
              levelIndexById={levelIndexById}
              siblings={node.children}
              parentPath={path}
            />
          ))}
        </div>
      ) : null}
    </div>
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
  const tree = buildVariantTree(nodes);
  const all = flattenVariantTree(tree);
  const sellable = all.filter((node) => node.children.length === 0 && node.variant);
  const activeSellable = sellable.filter(
    (node) => node.active && node.variant?.active && (node.variant?.stockQty ?? 0) > 0,
  );
  const levelIndexById = new Map(levels.map((level, index) => [level.id, index]));
  const firstLevel = levels[0];
  const rootValues = firstLevel
    ? firstLevel.values.filter(
        (value) => !tree.some((node) => node.optionValueId === value.id),
      )
    : [];
  const rootIsLeaf = levels.length === 1;

  if (levels.length === 0) {
    if (tree.length === 0) {
      return (
        <form
          action={createDefaultVariantAction}
          className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-line p-4"
        >
          <input type="hidden" name="productId" value={productId} />
          <div className="w-32">
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
            <Input
              id="default-stock"
              name="stock"
              type="number"
              min={0}
              placeholder="10"
              required
            />
          </div>
          <div className="w-40">
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
      <div className="mt-5 space-y-3">
        {tree.map((node) => (
          <NodeCard
            key={node.id}
            productId={productId}
            node={node}
            levels={[]}
            levelIndexById={new Map()}
            siblings={tree}
            parentPath={[]}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-line p-3">
          <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">Levels</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{levels.length}</p>
        </div>
        <div className="rounded-lg border border-line p-3">
          <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">Branches</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{all.length}</p>
        </div>
        <div className="rounded-lg border border-line p-3">
          <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
            Sellable leaves
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{sellable.length}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
            Active and in stock
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-700">
            {activeSellable.length}
          </p>
        </div>
      </div>

      {firstLevel && rootValues.length > 0 ? (
        <div className="rounded-xl border border-dashed border-line p-4">
          <p className="text-sm font-medium">
            Add top-level {firstLevel.name.toLowerCase()} branches
          </p>
          <p className="mt-1 text-xs text-muted">
            Only ticked values become roots. Children are added inside each branch below.
          </p>
          <form action={addVariantBranchesAction} className="mt-3 space-y-3">
            <input type="hidden" name="productId" value={productId} />
            <ValueCheckboxes values={rootValues} />
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-32">
                <Label htmlFor="root-price">
                  {rootIsLeaf ? "Price (AED)" : "Default price"}
                </Label>
                <Input
                  id="root-price"
                  name="price"
                  inputMode="decimal"
                  placeholder="120.00"
                  required={rootIsLeaf}
                />
              </div>
              <div className="w-28">
                <Label htmlFor="root-stock">
                  {rootIsLeaf ? "Stock" : "Default stock"}
                </Label>
                <Input
                  id="root-stock"
                  name="stock"
                  type="number"
                  min={0}
                  placeholder={rootIsLeaf ? "10" : ""}
                  required={rootIsLeaf}
                />
              </div>
              <Button type="submit" size="sm" variant="secondary">
                Add roots
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {tree.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-muted">
          No branches yet. Add a root above, then add its children.
        </p>
      ) : (
        <div className="space-y-3">
          {tree.map((node) => (
            <NodeCard
              key={node.id}
              productId={productId}
              node={node}
              levels={levels}
              levelIndexById={levelIndexById}
              siblings={tree}
              parentPath={[]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
