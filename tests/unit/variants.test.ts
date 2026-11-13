import { describe, expect, it } from "vitest";
import {
  buildVariantTree,
  effectiveImageKey,
  firstAvailableLeaf,
  firstAvailableLeafInTree,
  generateVariantSku,
  pathToNode,
  type VariantNodeView,
} from "@/lib/variants";

const leaf = (id: string, label: string, stockQty: number): VariantNodeView => ({
  id,
  parentId: "blue",
  optionId: "size",
  optionValueId: `size-${id}`,
  label,
  position: label === "S" ? 0 : 1,
  active: true,
  imageKey: null,
  imageAlt: "",
  defaultPriceMinor: null,
  defaultStockQty: null,
  variant: {
    id: `variant-${id}`,
    title: `Blue / ${label}`,
    sku: `TEE-BLU-${label}`,
    priceMinor: 12_000,
    salePriceMinor: null,
    saleStartsAt: null,
    saleEndsAt: null,
    stockQty,
    active: true,
  },
});

const blue: VariantNodeView = {
  id: "blue",
  parentId: null,
  optionId: "colour",
  optionValueId: "colour-blue",
  label: "Blue",
  position: 0,
  active: true,
  imageKey: null,
  imageAlt: "",
  defaultPriceMinor: 12_000,
  defaultStockQty: 10,
  variant: null,
};

const red: VariantNodeView = {
  ...blue,
  id: "red",
  optionValueId: "colour-red",
  label: "Red",
  position: 1,
};

const redSmall = leaf("red-s", "S", 1);
redSmall.parentId = "red";
redSmall.optionValueId = "size-red-s";

describe("buildVariantTree", () => {
  it("nests children under their parent and keeps position order", () => {
    const tree = buildVariantTree([blue, red, leaf("blue-m", "M", 0), leaf("blue-s", "S", 5), redSmall]);

    expect(tree.map((node) => node.label)).toEqual(["Blue", "Red"]);
    expect(tree[0]?.children.map((node) => node.label)).toEqual(["S", "M"]);
    expect(tree[1]?.children.map((node) => node.label)).toEqual(["S"]);
  });

  it("returns root-to-leaf paths", () => {
    const tree = buildVariantTree([blue, red, redSmall]);
    expect(pathToNode(tree, "red-s").map((node) => node.label)).toEqual(["Red", "S"]);
  });

  it("finds the first available leaf and skips sold-out branches", () => {
    const tree = buildVariantTree([blue, red, leaf("blue-m", "M", 0), redSmall]);
    expect(firstAvailableLeaf(tree[1]!)?.id).toBe("red-s");
    expect(firstAvailableLeafInTree(tree)?.id).toBe("red-s");
  });
});

describe("effectiveImageKey", () => {
  it("uses the nearest branch image on the path", () => {
    const blueWithImage = { ...blue, imageKey: "blue.webp" };
    const childWithImage = { ...leaf("blue-s", "S", 5), imageKey: "blue-s.webp" };
    const tree = buildVariantTree([blueWithImage, childWithImage]);

    expect(effectiveImageKey(pathToNode(tree, "blue-s"))).toBe("blue-s.webp");
    expect(effectiveImageKey([tree[0]!])).toBe("blue.webp");
  });
});

describe("generateVariantSku", () => {
  it("builds a readable path SKU", () => {
    expect(generateVariantSku("essential-tee", ["Blue", "M"], new Set())).toBe("ESSENTIA-BLUE-M");
  });

  it("de-duplicates with a numeric suffix", () => {
    expect(
      generateVariantSku("essential-tee", ["Blue", "M"], new Set(["ESSENTIA-BLUE-M"])),
    ).toBe("ESSENTIA-BLUE-M-2");
  });
});
