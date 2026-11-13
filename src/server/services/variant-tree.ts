import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  buildVariantTree,
  collectSubtreeVariantIds,
  firstAvailableLeaf,
  generateVariantSku,
  pathToNode,
  type VariantNodeView,
  type VariantTreeNode,
} from "@/lib/variants";
import { fail, ok, type Result } from "@/lib/result";
import { db } from "../db/client";
import {
  productOptionValues,
  productOptions,
  products,
  variantNodes,
  variants,
} from "../db/schema";

export type { VariantNodeView, VariantTreeNode };

type NodeRow = {
  id: string;
  parentId: string | null;
  optionId: string | null;
  optionValueId: string | null;
  label: string;
  position: number;
  active: boolean;
  imageKey: string | null;
  imageAlt: string;
  defaultPriceMinor: number | null;
  defaultStockQty: number | null;
  variantId: string | null;
  variantTitle: string | null;
  variantSku: string | null;
  variantPriceMinor: number | null;
  variantStockQty: number | null;
  variantActive: boolean | null;
};

async function listNodeRows(productIds: readonly string[]): Promise<NodeRow[]> {
  if (productIds.length === 0) return [];

  return db
    .select({
      id: variantNodes.id,
      parentId: variantNodes.parentId,
      optionId: variantNodes.optionId,
      optionValueId: variantNodes.optionValueId,
      label: variantNodes.label,
      position: variantNodes.position,
      active: variantNodes.active,
      imageKey: variantNodes.imageKey,
      imageAlt: variantNodes.imageAlt,
      defaultPriceMinor: variantNodes.defaultPriceMinor,
      defaultStockQty: variantNodes.defaultStockQty,
      variantId: variantNodes.variantId,
      variantTitle: variants.title,
      variantSku: variants.sku,
      variantPriceMinor: variants.priceMinor,
      variantStockQty: variants.stockQty,
      variantActive: variants.active,
    })
    .from(variantNodes)
    .leftJoin(variants, eq(variantNodes.variantId, variants.id))
    .where(inArray(variantNodes.productId, [...productIds]))
    .orderBy(asc(variantNodes.position), asc(variantNodes.createdAt));
}

function toView(row: NodeRow): VariantNodeView {
  const variant =
    row.variantId !== null
      ? {
          id: row.variantId,
          title: row.variantTitle ?? "",
          sku: row.variantSku ?? "",
          priceMinor: row.variantPriceMinor ?? 0,
          stockQty: row.variantStockQty ?? 0,
          active: row.variantActive ?? false,
        }
      : null;

  return {
    id: row.id,
    parentId: row.parentId,
    optionId: row.optionId,
    optionValueId: row.optionValueId,
    label: row.label,
    position: row.position,
    active: row.active,
    imageKey: row.imageKey,
    imageAlt: row.imageAlt,
    defaultPriceMinor: row.defaultPriceMinor,
    defaultStockQty: row.defaultStockQty,
    variant,
  };
}

export async function getVariantTree(productId: string): Promise<VariantTreeNode[]> {
  const rows = await listNodeRows([productId]);
  return buildVariantTree(rows.map(toView));
}

export async function listVariantNodes(productId: string): Promise<VariantNodeView[]> {
  const rows = await listNodeRows([productId]);
  return rows.map(toView);
}

/** One map of variant id to its root-to-leaf labels, for cart and order display. */
export async function getVariantPathLabels(
  productIds: readonly string[],
): Promise<Map<string, string[]>> {
  const rows = await listNodeRows(productIds);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const labels = new Map<string, string[]>();

  for (const row of rows) {
    if (!row.variantId) continue;

    const path: string[] = [];
    let current: NodeRow | undefined = row;
    while (current) {
      if (current.optionId) path.unshift(current.label);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    labels.set(row.variantId, path);
  }

  return labels;
}

async function requireProduct(productId: string) {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  return product ?? null;
}

/** SKUs are globally unique, so auto-generation must know every existing SKU. */
async function allTakenSkus(): Promise<Set<string>> {
  const rows = await db.select({ sku: variants.sku }).from(variants);
  return new Set(rows.map((row) => row.sku));
}

async function requireNextOption(parentId: string | null, productId: string) {
  const options = await db
    .select()
    .from(productOptions)
    .where(eq(productOptions.productId, productId))
    .orderBy(asc(productOptions.position));

  if (options.length === 0) return { error: "Add a level first." as const };

  if (!parentId) {
    return { option: options[0]!, index: 0, options };
  }

  const [parent] = await db
    .select()
    .from(variantNodes)
    .where(and(eq(variantNodes.id, parentId), eq(variantNodes.productId, productId)))
    .limit(1);

  if (!parent) return { error: "That branch does not belong to this product." as const };
  if (parent.variantId) {
    return { error: "This branch is already a sellable variant. Remove its variant before adding children." as const };
  }

  const index = options.findIndex((option) => option.id === parent.optionId);
  const next = index >= 0 ? options[index + 1] : undefined;
  if (!next) return { error: "This branch is already at the last level." as const };

  return { option: next, index: index + 1, options, parent };
}

export async function createVariantBranches(input: {
  productId: string;
  parentId: string | null;
  optionValueIds: string[];
  priceMinor?: number | null;
  stockQty?: number | null;
}): Promise<Result<{ created: number }>> {
  const product = await requireProduct(input.productId);
  if (!product) return fail("Product not found.");

  const next = await requireNextOption(input.parentId, input.productId);
  if ("error" in next) return fail(next.error ?? "Could not add the branch.");

  const valueIds = [...new Set(input.optionValueIds)];
  if (valueIds.length === 0) return fail("Choose at least one value.");

  const values = await db
    .select()
    .from(productOptionValues)
    .where(inArray(productOptionValues.id, valueIds))
    .orderBy(asc(productOptionValues.position));

  if (values.length !== valueIds.length || values.some((value) => value.optionId !== next.option.id)) {
    return fail("Some of those values do not belong to the next level.");
  }

  const siblingRows = await db
    .select()
    .from(variantNodes)
    .where(
      and(
        eq(variantNodes.productId, input.productId),
        input.parentId ? eq(variantNodes.parentId, input.parentId) : isNull(variantNodes.parentId),
      ),
    );

  const usedValueIds = new Set(siblingRows.map((row) => row.optionValueId));
  const valuesToCreate = values.filter((value) => !usedValueIds.has(value.id));
  if (valuesToCreate.length === 0) return fail("Those values are already in this branch.");

  const isLeafLevel = next.index === next.options.length - 1;
  const parentDefaults = "parent" in next ? next.parent : undefined;
  const priceMinor = input.priceMinor ?? parentDefaults?.defaultPriceMinor ?? null;
  const stockQty = input.stockQty ?? parentDefaults?.defaultStockQty ?? 0;

  if (isLeafLevel && (priceMinor === null || !Number.isInteger(priceMinor) || priceMinor < 0)) {
    return fail("Enter a valid price for the new variants.");
  }
  if (!Number.isInteger(stockQty) || stockQty < 0) {
    return fail("Enter a valid stock count.");
  }

  const tree = await getVariantTree(input.productId);
  const parentPath = input.parentId ? pathToNode(tree, input.parentId) : [];
  const parentLabels = parentPath.map((node) => node.label);
  const takenSkus = await allTakenSkus();

  let nextPosition = Math.max(-1, ...siblingRows.map((row) => row.position)) + 1;
  let created = 0;

  await db.transaction(async (tx) => {
    for (const value of valuesToCreate) {
      const labels = [...parentLabels, value.value];

      if (isLeafLevel) {
        const sku = generateVariantSku(product.slug, labels, takenSkus);
        takenSkus.add(sku);

        const [variant] = await tx
          .insert(variants)
          .values({
            productId: product.id,
            sku,
            title: labels.join(" / ") || "Default",
            priceMinor: priceMinor as number,
            stockQty,
            position: nextPosition,
            active: true,
          })
          .returning({ id: variants.id });

        if (!variant) throw new Error("Could not create the variant.");

        await tx.insert(variantNodes).values({
          productId: product.id,
          parentId: input.parentId,
          optionId: next.option.id,
          optionValueId: value.id,
          label: value.value,
          position: nextPosition,
          active: true,
          defaultPriceMinor: priceMinor,
          defaultStockQty: stockQty,
          variantId: variant.id,
        });
      } else {
        await tx.insert(variantNodes).values({
          productId: product.id,
          parentId: input.parentId,
          optionId: next.option.id,
          optionValueId: value.id,
          label: value.value,
          position: nextPosition,
          active: true,
          defaultPriceMinor: priceMinor,
          defaultStockQty: stockQty,
        });
      }

      nextPosition += 1;
      created += 1;
    }
  });

  return ok({ created });
}

export async function updateVariantNode(input: {
  productId: string;
  nodeId: string;
  active?: boolean;
  defaultPriceMinor?: number | null;
  defaultStockQty?: number | null;
}): Promise<Result<{ updated: true }>> {
  const [node] = await db
    .select()
    .from(variantNodes)
    .where(and(eq(variantNodes.id, input.nodeId), eq(variantNodes.productId, input.productId)))
    .limit(1);

  if (!node) return fail("That branch could not be found.");

  await db.transaction(async (tx) => {
    await tx
      .update(variantNodes)
      .set({
        ...(input.active === undefined ? {} : { active: input.active }),
        ...(input.defaultPriceMinor === undefined
          ? {}
          : { defaultPriceMinor: input.defaultPriceMinor }),
        ...(input.defaultStockQty === undefined
          ? {}
          : { defaultStockQty: input.defaultStockQty }),
        updatedAt: new Date(),
      })
      .where(eq(variantNodes.id, node.id));

    if (node.variantId && input.active !== undefined) {
      await tx
        .update(variants)
        .set({ active: input.active, updatedAt: new Date() })
        .where(eq(variants.id, node.variantId));
    }
  });

  return ok({ updated: true });
}

export async function deleteVariantNode(input: {
  productId: string;
  nodeId: string;
}): Promise<Result<{ deleted: true }>> {
  const tree = await getVariantTree(input.productId);
  const node = pathToNode(tree, input.nodeId).at(-1);
  if (!node) return fail("That branch could not be found.");

  const variantIds = collectSubtreeVariantIds(node);

  await db.transaction(async (tx) => {
    if (variantIds.length > 0) {
      await tx.delete(variants).where(inArray(variants.id, variantIds));
    }
    await tx
      .delete(variantNodes)
      .where(and(eq(variantNodes.id, input.nodeId), eq(variantNodes.productId, input.productId)));
  });

  return ok({ deleted: true });
}

/**
 * Copies a sibling's children under another parent. Existing child values are
 * skipped; copied leaves get new SKUs from the target path and reuse the source
 * price/stock so the admin can edit them afterwards.
 */
export async function copyVariantChildren(input: {
  productId: string;
  sourceNodeId: string;
  targetNodeId: string;
}): Promise<Result<{ copied: number }>> {
  const product = await requireProduct(input.productId);
  if (!product) return fail("Product not found.");
  if (input.sourceNodeId === input.targetNodeId) return fail("Choose a different branch.");

  const tree = await getVariantTree(input.productId);
  const source = pathToNode(tree, input.sourceNodeId).at(-1);
  const target = pathToNode(tree, input.targetNodeId).at(-1);

  if (!source || !target) return fail("That branch could not be found.");
  if (source.parentId !== target.parentId) {
    return fail("Copy only works between branches at the same level.");
  }
  if (source.children.length === 0) return fail("The source branch has no children.");
  if (target.variant) {
    return fail("Remove the target's sellable variant before copying children into it.");
  }

  const targetPath = pathToNode(tree, target.id).map((node) => node.label);
  const takenSkus = await allTakenSkus();

  let copied = 0;

  await db.transaction(async (tx) => {
    const copyChildren = async (
      sourceParent: VariantTreeNode,
      targetParentId: string,
      targetLabels: string[],
      startPosition: number,
    ): Promise<number> => {
      let position = startPosition;
      let count = 0;

      const existing = await tx
        .select({ optionValueId: variantNodes.optionValueId, position: variantNodes.position })
        .from(variantNodes)
        .where(eq(variantNodes.parentId, targetParentId));

      const used = new Set(existing.map((row) => row.optionValueId));
      position = Math.max(position, ...existing.map((row) => row.position + 1));

      for (const child of sourceParent.children) {
        if (!child.optionValueId || used.has(child.optionValueId)) continue;

        const labels = [...targetLabels, child.label];
        let variantId: string | null = null;

        if (child.variant) {
          const sku = generateVariantSku(product.slug, labels, takenSkus);
          takenSkus.add(sku);

          const [variant] = await tx
            .insert(variants)
            .values({
              productId: product.id,
              sku,
              title: labels.join(" / ") || child.variant.title || "Default",
              priceMinor: child.variant.priceMinor,
              stockQty: child.variant.stockQty,
              position,
              active: child.variant.active,
            })
            .returning({ id: variants.id });

          if (!variant) throw new Error("Could not copy the variant.");
          variantId = variant.id;
        }

        const [created] = await tx
          .insert(variantNodes)
          .values({
            productId: product.id,
            parentId: targetParentId,
            optionId: child.optionId,
            optionValueId: child.optionValueId,
            label: child.label,
            position,
            active: child.active,
            imageKey: child.imageKey,
            imageAlt: child.imageAlt,
            defaultPriceMinor: child.defaultPriceMinor,
            defaultStockQty: child.defaultStockQty,
            variantId,
          })
          .returning({ id: variantNodes.id });

        if (!created) throw new Error("Could not copy the branch.");

        used.add(child.optionValueId);
        position += 1;
        count += 1;

        if (child.children.length > 0) {
          count += await copyChildren(child, created.id, labels, 0);
        }
      }

      return count;
    };

    copied = await copyChildren(source, target.id, targetPath, 0);
  });

  if (copied === 0) return fail("There were no new child values to copy.");
  return ok({ copied });
}

/**
 * Creates the sellable variant for an existing leaf node that does not have
 * one (for example a node whose children were all removed).
 */
export async function createLeafVariant(input: {
  productId: string;
  nodeId: string;
  priceMinor: number;
  stockQty: number;
  sku?: string;
}): Promise<Result<{ variantId: string }>> {
  const product = await requireProduct(input.productId);
  if (!product) return fail("Product not found.");

  const [node] = await db
    .select()
    .from(variantNodes)
    .where(and(eq(variantNodes.id, input.nodeId), eq(variantNodes.productId, input.productId)))
    .limit(1);

  if (!node) return fail("That branch could not be found.");
  if (node.variantId) return fail("This branch already has a variant.");

  const children = await db
    .select({ id: variantNodes.id })
    .from(variantNodes)
    .where(eq(variantNodes.parentId, node.id))
    .limit(1);

  if (children.length > 0) return fail("This branch has children and cannot be sold directly.");

  if (!Number.isInteger(input.priceMinor) || input.priceMinor < 0) {
    return fail("Enter a valid price.");
  }
  if (!Number.isInteger(input.stockQty) || input.stockQty < 0) {
    return fail("Enter a valid stock count.");
  }

  const tree = await getVariantTree(input.productId);
  const labels = pathToNode(tree, node.id).map((item) => item.label);

  const takenSkus = await allTakenSkus();

  const sku = input.sku?.trim() || generateVariantSku(product.slug, labels, takenSkus);
  if (takenSkus.has(sku)) return fail("That SKU is already in use.");

  return db.transaction(async (tx) => {
    const [variant] = await tx
      .insert(variants)
      .values({
        productId: product.id,
        sku,
        title: labels.join(" / ") || "Default",
        priceMinor: input.priceMinor,
        stockQty: input.stockQty,
        position: node.position,
        active: node.active,
      })
      .returning({ id: variants.id });

    if (!variant) return fail("Could not create the variant.");

    await tx
      .update(variantNodes)
      .set({ variantId: variant.id, updatedAt: new Date() })
      .where(eq(variantNodes.id, node.id));

    return ok({ variantId: variant.id });
  });
}

/** First node in a tree with stock, used by the storefront picker. */
export function firstSellableNode(tree: readonly VariantTreeNode[]): VariantTreeNode | null {
  for (const node of tree) {
    const found = firstAvailableLeaf(node);
    if (found) return found;
  }
  return null;
}

/** Creates the single leaf for a product that has no variant levels. */
export async function createDefaultVariant(input: {
  productId: string;
  priceMinor: number;
  stockQty: number;
  sku?: string;
}): Promise<Result<{ variantId: string }>> {
  const product = await requireProduct(input.productId);
  if (!product) return fail("Product not found.");

  const options = await db
    .select({ id: productOptions.id })
    .from(productOptions)
    .where(eq(productOptions.productId, input.productId))
    .limit(1);

  if (options.length > 0) {
    return fail("This product has levels. Add the branch in the tree instead.");
  }

  const existing = await db
    .select({ id: variantNodes.id })
    .from(variantNodes)
    .where(eq(variantNodes.productId, input.productId))
    .limit(1);

  if (existing.length > 0) return fail("This product already has a default variant.");

  if (!Number.isInteger(input.priceMinor) || input.priceMinor < 0) {
    return fail("Enter a valid price.");
  }
  if (!Number.isInteger(input.stockQty) || input.stockQty < 0) {
    return fail("Enter a valid stock count.");
  }

  const takenSkus = await allTakenSkus();
  const sku = input.sku?.trim() || generateVariantSku(product.slug, ["Default"], takenSkus);

  return db.transaction(async (tx) => {
    const [variant] = await tx
      .insert(variants)
      .values({
        productId: product.id,
        sku,
        title: "Default",
        priceMinor: input.priceMinor,
        stockQty: input.stockQty,
        position: 0,
        active: true,
      })
      .returning({ id: variants.id });

    if (!variant) return fail("Could not create the variant.");

    await tx.insert(variantNodes).values({
      productId: product.id,
      parentId: null,
      optionId: null,
      optionValueId: null,
      label: "Default",
      position: 0,
      active: true,
      defaultPriceMinor: input.priceMinor,
      defaultStockQty: input.stockQty,
      variantId: variant.id,
    });

    return ok({ variantId: variant.id });
  });
}
