export type CategoryRecord = {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string;
  position: number;
  active: boolean;
};

export type CategoryNode = CategoryRecord & {
  children: CategoryNode[];
};

function byPosition(a: CategoryRecord, b: CategoryRecord): number {
  return a.position - b.position || a.name.localeCompare(b.name);
}

export function buildCategoryTree(categories: readonly CategoryRecord[]): CategoryNode[] {
  const byId = new Map<string, CategoryNode>();
  for (const category of categories) byId.set(category.id, { ...category, children: [] });

  const roots: CategoryNode[] = [];
  for (const category of byId.values()) {
    const parent = category.parentId ? byId.get(category.parentId) : undefined;
    if (parent) parent.children.push(category);
    else roots.push(category);
  }

  const sort = (nodes: CategoryNode[]) => {
    nodes.sort(byPosition);
    for (const node of nodes) sort(node.children);
  };
  sort(roots);

  return roots;
}

export type FlatCategory = CategoryNode & { depth: number };

export function flattenCategoryTree(
  nodes: readonly CategoryNode[],
  depth = 0,
): FlatCategory[] {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenCategoryTree(node.children, depth + 1),
  ]);
}

export function categoryPath(
  tree: readonly CategoryNode[],
  categoryId: string,
): CategoryNode[] {
  for (const node of tree) {
    if (node.id === categoryId) return [node];
    const childPath = categoryPath(node.children, categoryId);
    if (childPath.length > 0) return [node, ...childPath];
  }
  return [];
}

export function findCategoryById(
  tree: readonly CategoryNode[],
  categoryId: string,
): CategoryNode | null {
  for (const node of tree) {
    if (node.id === categoryId) return node;
    const found = findCategoryById(node.children, categoryId);
    if (found) return found;
  }
  return null;
}

export function descendantIds(node: CategoryNode): string[] {
  return [node.id, ...node.children.flatMap((child) => descendantIds(child))];
}
