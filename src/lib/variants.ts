export type VariantLeaf = {
  id: string;
  title: string;
  sku: string;
  priceMinor: number;
  stockQty: number;
  active: boolean;
};

/**
 * One node in the product's variant tree. It is either a group (has children)
 * or a sellable leaf (has a variant). The tree is explicit: a path exists only
 * because the merchant created it.
 */
export type VariantNodeView = {
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
  variant: VariantLeaf | null;
};

export type VariantTreeNode = VariantNodeView & {
  children: VariantTreeNode[];
};

function byPosition(a: VariantNodeView, b: VariantNodeView): number {
  return a.position - b.position || a.label.localeCompare(b.label);
}

/** Turn a flat node list into a sorted tree. */
export function buildVariantTree(nodes: readonly VariantNodeView[]): VariantTreeNode[] {
  const byId = new Map<string, VariantTreeNode>();
  for (const node of nodes) byId.set(node.id, { ...node, children: [] });

  const roots: VariantTreeNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sort = (list: VariantTreeNode[]) => {
    list.sort(byPosition);
    for (const node of list) sort(node.children);
  };
  sort(roots);

  return roots;
}

export function flattenVariantTree(nodes: readonly VariantTreeNode[]): VariantTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenVariantTree(node.children)]);
}

/** Root-to-node path for a node id, or an empty path. */
export function pathToNode(
  nodes: readonly VariantTreeNode[],
  nodeId: string,
  trail: VariantTreeNode[] = [],
): VariantTreeNode[] {
  for (const node of nodes) {
    const path = [...trail, node];
    if (node.id === nodeId) return path;
    const found = pathToNode(node.children, nodeId, path);
    if (found.length > 0) return found;
  }
  return [];
}

/** The first leaf with stock in this branch, respecting active flags. */
export function firstAvailableLeaf(node: VariantTreeNode): VariantTreeNode | null {
  if (!node.active) return null;

  if (node.children.length === 0) {
    return node.variant && node.variant.active && node.variant.stockQty > 0 ? node : null;
  }

  for (const child of node.children) {
    const found = firstAvailableLeaf(child);
    if (found) return found;
  }
  return null;
}

/** The first leaf even when sold out, so the picker can explain the state. */
export function firstLeaf(node: VariantTreeNode): VariantTreeNode | null {
  if (!node.active) return null;
  if (node.children.length === 0) return node.variant ? node : null;

  for (const child of node.children) {
    const found = firstLeaf(child);
    if (found) return found;
  }
  return null;
}

export function firstAvailableLeafInTree(nodes: readonly VariantTreeNode[]): VariantTreeNode | null {
  for (const node of nodes) {
    const found = firstAvailableLeaf(node);
    if (found) return found;
  }
  return null;
}

export function firstLeafInTree(nodes: readonly VariantTreeNode[]): VariantTreeNode | null {
  for (const node of nodes) {
    const found = firstLeaf(node);
    if (found) return found;
  }
  return null;
}

/** Nearest branch image on a root-to-leaf path, or null. */
export function effectiveImageKey(path: readonly VariantTreeNode[]): string | null {
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const key = path[index]?.imageKey;
    if (key) return key;
  }
  return null;
}

export function collectSubtreeVariantIds(node: VariantTreeNode): string[] {
  const ids = node.variant ? [node.variant.id] : [];
  for (const child of node.children) ids.push(...collectSubtreeVariantIds(child));
  return ids;
}

export function collectSubtreeNodeIds(node: VariantTreeNode): string[] {
  const ids = [node.id];
  for (const child of node.children) ids.push(...collectSubtreeNodeIds(child));
  return ids;
}

function skuPart(label: string, index: number): string {
  const ascii = label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();

  return ascii.slice(0, 4) || `V${index + 1}`;
}

/** A readable SKU from the product slug and the branch labels, de-duplicated. */
export function generateVariantSku(
  productSlug: string,
  labels: readonly string[],
  taken: ReadonlySet<string>,
): string {
  const prefix = productSlug.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase() || "SKU";
  const base = [prefix, ...labels.map(skuPart)].join("-").slice(0, 48);

  if (!taken.has(base)) return base;

  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}
