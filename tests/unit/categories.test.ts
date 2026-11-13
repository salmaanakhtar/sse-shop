import { describe, expect, it } from "vitest";
import {
  buildCategoryTree,
  categoryPath,
  descendantIds,
  findCategoryById,
  flattenCategoryTree,
  type CategoryRecord,
} from "@/lib/categories";

function category(
  id: string,
  name: string,
  parentId: string | null,
  position: number,
): CategoryRecord {
  return {
    id,
    parentId,
    name,
    slug: name.toLowerCase(),
    description: "",
    position,
    active: true,
  };
}

describe("buildCategoryTree", () => {
  it("nests children and orders every level by position", () => {
    const tree = buildCategoryTree([
      category("tops", "Tops", "apparel", 1),
      category("apparel", "Apparel", null, 1),
      category("accessories", "Accessories", null, 0),
      category("tees", "Tees", "tops", 0),
    ]);

    expect(tree.map((node) => node.name)).toEqual(["Accessories", "Apparel"]);
    expect(tree[1]?.children.map((node) => node.name)).toEqual(["Tops"]);
    expect(tree[1]?.children[0]?.children.map((node) => node.name)).toEqual(["Tees"]);
  });

  it("treats a missing parent as a root instead of hiding the row", () => {
    const tree = buildCategoryTree([category("orphan", "Orphan", "gone", 0)]);
    expect(tree.map((node) => node.name)).toEqual(["Orphan"]);
  });
});

describe("flattenCategoryTree", () => {
  it("returns depth-first rows with their depth", () => {
    const tree = buildCategoryTree([
      category("apparel", "Apparel", null, 0),
      category("tops", "Tops", "apparel", 0),
      category("tees", "Tees", "tops", 0),
      category("accessories", "Accessories", null, 1),
    ]);

    expect(flattenCategoryTree(tree).map((node) => [node.name, node.depth])).toEqual([
      ["Apparel", 0],
      ["Tops", 1],
      ["Tees", 2],
      ["Accessories", 0],
    ]);
  });
});

describe("categoryPath", () => {
  const tree = buildCategoryTree([
    category("apparel", "Apparel", null, 0),
    category("tops", "Tops", "apparel", 0),
    category("tees", "Tees", "tops", 0),
  ]);

  it("returns the root-to-leaf path", () => {
    expect(categoryPath(tree, "tees").map((node) => node.name)).toEqual([
      "Apparel",
      "Tops",
      "Tees",
    ]);
  });

  it("returns an empty path for an unknown id", () => {
    expect(categoryPath(tree, "missing")).toEqual([]);
  });

  it("finds a node anywhere in the tree", () => {
    expect(findCategoryById(tree, "tops")?.name).toBe("Tops");
    expect(findCategoryById(tree, "missing")).toBeNull();
  });
});

describe("descendantIds", () => {
  it("includes the node and every descendant", () => {
    const tree = buildCategoryTree([
      category("apparel", "Apparel", null, 0),
      category("tops", "Tops", "apparel", 0),
      category("tees", "Tees", "tops", 0),
      category("accessories", "Accessories", null, 1),
    ]);

    expect(descendantIds(tree[0]!)).toEqual(["apparel", "tops", "tees"]);
  });
});
