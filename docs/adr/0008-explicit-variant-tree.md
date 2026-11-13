# Explicit variant tree, not a Cartesian product

A product's variants are stored as an explicit tree. A branch exists only because the merchant
created it, so there is no "Red / L" row to deactivate when Red does not come in L.

## Context

The first catalog model treated each product as a set of options and generated the full Cartesian
product. That is convenient for apparel where every colour has every size, but it is wrong for a
catalog where branches differ: Blue has S/M/L, Red has S/M only. Generating every combination
creates rows that do not exist, adds stock and SKU cleanup work, and makes the admin look as if it
understands a product it does not. The store is not apparel; depth must be configurable per product.

## Decision

### Levels and values

`product_options` defines ordered levels (Colour, then Size, then Fit). `product_option_values`
defines the value names available at each level. Level names are shared across the product; values
are shared labels, but each parent chooses which of them exist underneath it.

### Tree nodes

`variant_nodes` is a self-referencing tree:

- A **group** has children and is not sellable. It can carry an image and default price/stock.
- A **leaf** has no children and points at one `variants` row. The variant owns the real SKU,
  price, stock, and active flag.
- A root is a value of the first level. A product with no levels can have one default leaf.
- Parent defaults pre-fill the add-child form; they do not rewrite existing leaves.
- Branch images fall back from leaf to nearest ancestor, then the product gallery.

### Admin

The tree builder adds roots and children, copies a sibling's subtree, edits parent defaults and
images, edits leaf details, and deletes a branch with its descendants. It never generates a
combination the merchant did not select. Levels are locked once the tree has branches; deleting a
level or value removes the branches built from it. Orders keep their snapshots.

Auto-generated SKUs use the product slug and branch labels, then a numeric suffix if the SKU is
already taken. Every SKU remains editable and globally unique.

### Storefront

The picker is parent-first: choose Colour, then only that colour's children. Branches with no
available leaf are visible but disabled; the initial selection is the first available leaf. Cart and
order labels come from the leaf's path.

### Migration

The pre-launch migration created `variant_nodes` from every existing variant, using the old
`variant_option_values` rows to build the path, then dropped the old join table. A variant with no
option values became a default leaf.

## Consequences

- The admin can model an asymmetric catalog directly: Red simply has no L child.
- No phantom variants, stock rows, or SKUs are created.
- Deleting a branch deletes its descendants and their variants; this is destructive and the admin
  confirms it. Orders remain intact because line items are snapshots.
- Levels are fixed once branches exist, which keeps parent links consistent. A merchant who needs a
  new level deletes the tree and rebuilds it before publishing.
- Parent defaults are creation-time only. A later default change is a template, not a bulk edit.
- SKU generation must check the global SKU set, because `variants.sku` is unique across the store.
- The storefront can only show branches the admin created, so the picker cannot lead a shopper to
  an impossible combination.

## Considered options

- **Keep the Cartesian product and deactivate impossible rows:** rejected. It creates data that
  should not exist and turns every product setup into cleanup.
- **A matrix with checkboxes:** workable, but it still presents the full grid and makes the merchant
  reason about exclusions. The tree matches the mental model of parent values with their own child
  sets, and supports arbitrary depth.
- **Store the tree as JSON on the product:** rejected. It would be hard to query, index, and keep
  referential integrity with variants, carts, and orders.
- **Separate parent and child tables:** rejected as a special case of two levels. The self-referencing
  node table supports two levels and deeper levels with one shape.
- **Auto-claim every possible path when a value is added:** rejected for the same reason as the
  Cartesian product.
