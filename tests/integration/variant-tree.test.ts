import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { flattenVariantTree, type VariantTreeNode } from "@/lib/variants";
import { db } from "@/server/db/client";
import {
  productOptionValues,
  productOptions,
  products,
  variants,
} from "@/server/db/schema";
import {
  bulkUpdateVariantLeaves,
  copyVariantChildren,
  createVariantBranches,
  deleteVariantNode,
  getVariantTree,
} from "@/server/services/variant-tree";

const suffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function setupProduct() {
  const [product] = await db
    .insert(products)
    .values({
      slug: `tree-${suffix()}`,
      title: "Tree Test",
      status: "draft",
    })
    .returning();
  if (!product) throw new Error("could not create the test product");

  const [colour] = await db
    .insert(productOptions)
    .values({ productId: product.id, name: "Colour", position: 0 })
    .returning();
  const [size] = await db
    .insert(productOptions)
    .values({ productId: product.id, name: "Size", position: 1 })
    .returning();
  if (!colour || !size) throw new Error("could not create the test levels");

  const values = await db
    .insert(productOptionValues)
    .values([
      { optionId: colour.id, value: "Blue", position: 0 },
      { optionId: colour.id, value: "Red", position: 1 },
      { optionId: size.id, value: "S", position: 0 },
      { optionId: size.id, value: "M", position: 1 },
      { optionId: size.id, value: "L", position: 2 },
    ])
    .returning();

  const find = (value: string) => {
    const row = values.find((item) => item.value === value);
    if (!row) throw new Error(`missing test value ${value}`);
    return row;
  };

  return {
    product,
    colour,
    size,
    blue: find("Blue"),
    red: find("Red"),
    s: find("S"),
    m: find("M"),
    l: find("L"),
  };
}

function children(tree: VariantTreeNode[], label: string): VariantTreeNode[] {
  return tree.find((node) => node.label === label)?.children ?? [];
}

describe("variant tree", () => {
  it("only creates the branches the admin adds", async () => {
    const setup = await setupProduct();

    const roots = await createVariantBranches({
      productId: setup.product.id,
      parentId: null,
      optionValueIds: [setup.blue.id, setup.red.id],
      priceMinor: 12_000,
      stockQty: 10,
    });
    expect(roots.ok).toBe(true);

    // Blue gets S and M; Red gets S only. Red/L must never exist.
    expect(
      (
        await createVariantBranches({
          productId: setup.product.id,
          parentId: (await getVariantTree(setup.product.id))[0]!.id,
          optionValueIds: [setup.s.id, setup.m.id],
        })
      ).ok,
    ).toBe(true);

    const treeAfterBlue = await getVariantTree(setup.product.id);
    const redNode = treeAfterBlue.find((node) => node.label === "Red");
    if (!redNode) throw new Error("missing Red root");

    expect(
      (
        await createVariantBranches({
          productId: setup.product.id,
          parentId: redNode.id,
          optionValueIds: [setup.s.id],
        })
      ).ok,
    ).toBe(true);

    const tree = await getVariantTree(setup.product.id);
    const leaves = flattenVariantTree(tree).filter((node) => node.children.length === 0);

    expect(leaves).toHaveLength(3);
    expect(children(tree, "Blue").map((node) => node.label)).toEqual(["S", "M"]);
    expect(children(tree, "Red").map((node) => node.label)).toEqual(["S"]);
    expect(children(tree, "Red").some((node) => node.label === "L")).toBe(false);

    // Children inherit the parent's default price/stock.
    const blueS = children(tree, "Blue").find((node) => node.label === "S");
    expect(blueS?.variant?.priceMinor).toBe(12_000);
    expect(blueS?.variant?.stockQty).toBe(10);
    expect(blueS?.variant?.sku).toMatch(/BLUE-S(?:-\d+)?$/);
  });

  it("copies a sibling's children and creates new SKUs for the target path", async () => {
    const setup = await setupProduct();

    await createVariantBranches({
      productId: setup.product.id,
      parentId: null,
      optionValueIds: [setup.blue.id, setup.red.id],
      priceMinor: 12_000,
      stockQty: 10,
    });

    let tree = await getVariantTree(setup.product.id);
    const blueId = tree.find((node) => node.label === "Blue")!.id;
    const redId = tree.find((node) => node.label === "Red")!.id;

    await createVariantBranches({
      productId: setup.product.id,
      parentId: blueId,
      optionValueIds: [setup.s.id, setup.m.id],
    });
    await createVariantBranches({
      productId: setup.product.id,
      parentId: redId,
      optionValueIds: [setup.s.id],
    });

    const copied = await copyVariantChildren({
      productId: setup.product.id,
      sourceNodeId: blueId,
      targetNodeId: redId,
    });
    expect(copied.ok).toBe(true);
    if (copied.ok) expect(copied.data.copied).toBe(1);

    tree = await getVariantTree(setup.product.id);
    const redChildren = children(tree, "Red");
    expect(redChildren.map((node) => node.label)).toEqual(["S", "M"]);

    const redM = redChildren.find((node) => node.label === "M");
    expect(redM?.variant?.sku).toMatch(/RED-M(?:-\d+)?$/);
    expect(redM?.variant?.sku).not.toBe(
      children(tree, "Blue").find((node) => node.label === "M")?.variant?.sku,
    );
  });

  it("deletes a branch and its variants without touching its sibling", async () => {
    const setup = await setupProduct();

    await createVariantBranches({
      productId: setup.product.id,
      parentId: null,
      optionValueIds: [setup.blue.id, setup.red.id],
      priceMinor: 12_000,
      stockQty: 10,
    });

    let tree = await getVariantTree(setup.product.id);
    const blueId = tree.find((node) => node.label === "Blue")!.id;
    const redId = tree.find((node) => node.label === "Red")!.id;

    await createVariantBranches({
      productId: setup.product.id,
      parentId: blueId,
      optionValueIds: [setup.s.id],
    });
    await createVariantBranches({
      productId: setup.product.id,
      parentId: redId,
      optionValueIds: [setup.s.id],
    });

    const deleted = await deleteVariantNode({ productId: setup.product.id, nodeId: blueId });
    expect(deleted.ok).toBe(true);

    tree = await getVariantTree(setup.product.id);
    expect(tree.map((node) => node.label)).toEqual(["Red"]);

    const remainingVariants = await db
      .select({ id: variants.id })
      .from(variants)
      .where(eq(variants.productId, setup.product.id));
    expect(remainingVariants).toHaveLength(1);
  });

  it("bulk-updates price and stock across selected leaves", async () => {
    const setup = await setupProduct();

    await createVariantBranches({
      productId: setup.product.id,
      parentId: null,
      optionValueIds: [setup.blue.id],
      priceMinor: 12_000,
      stockQty: 10,
    });
    const tree = await getVariantTree(setup.product.id);
    const blueId = tree[0]!.id;

    await createVariantBranches({
      productId: setup.product.id,
      parentId: blueId,
      optionValueIds: [setup.s.id, setup.m.id],
    });

    const leaves = flattenVariantTree(await getVariantTree(setup.product.id)).filter(
      (node) => node.variant,
    );
    const variantIds = leaves.map((node) => node.variant!.id);
    expect(variantIds).toHaveLength(2);

    const updated = await bulkUpdateVariantLeaves({
      productId: setup.product.id,
      variantIds,
      priceMinor: 15_000,
      stockQty: 7,
    });
    expect(updated.ok).toBe(true);

    const rows = await db
      .select({ priceMinor: variants.priceMinor, stockQty: variants.stockQty })
      .from(variants)
      .where(eq(variants.productId, setup.product.id));

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.priceMinor === 15_000 && row.stockQty === 7)).toBe(true);

    const stockOnly = await bulkUpdateVariantLeaves({
      productId: setup.product.id,
      variantIds: [variantIds[0]!],
      stockQty: 3,
    });
    expect(stockOnly.ok).toBe(true);

    const [first] = await db
      .select({ priceMinor: variants.priceMinor, stockQty: variants.stockQty })
      .from(variants)
      .where(eq(variants.id, variantIds[0]!));
    expect(first).toEqual({ priceMinor: 15_000, stockQty: 3 });
  });
});
