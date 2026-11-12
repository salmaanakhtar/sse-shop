import { asc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import {
  productOptionValues,
  productOptions,
  products,
  variantOptionValues,
  variants,
} from "../db/schema";

export type GenerateVariantsResult =
  | { ok: true; created: number }
  | { ok: false; error: string };

/**
 * Creates one variant per option combination that does not exist yet.
 * Existing combinations are left alone, so it is safe to run again after
 * adding a value.
 */
export async function generateMissingVariants(input: {
  productId: string;
  priceMinor: number;
  stockQty: number;
}): Promise<GenerateVariantsResult> {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, input.productId))
    .limit(1);

  if (!product) return { ok: false, error: "Product not found." };

  const optionRows = await db
    .select()
    .from(productOptions)
    .where(eq(productOptions.productId, product.id))
    .orderBy(asc(productOptions.position));

  if (optionRows.length === 0) return { ok: false, error: "Add an option first." };

  const valueRows = await db
    .select()
    .from(productOptionValues)
    .where(inArray(productOptionValues.optionId, optionRows.map((option) => option.id)))
    .orderBy(asc(productOptionValues.position));

  let combinations: { optionId: string; valueId: string }[][] = [[]];

  for (const option of optionRows) {
    const owned = valueRows.filter((value) => value.optionId === option.id);
    if (owned.length === 0) {
      return { ok: false, error: `"${option.name}" has no values yet.` };
    }

    combinations = combinations.flatMap((combination) =>
      owned.map((value) => [...combination, { optionId: option.id, valueId: value.id }]),
    );
  }

  const existingVariants = await db
    .select()
    .from(variants)
    .where(eq(variants.productId, product.id));

  const existingLinks =
    existingVariants.length > 0
      ? await db
          .select()
          .from(variantOptionValues)
          .where(
            inArray(
              variantOptionValues.variantId,
              existingVariants.map((variant) => variant.id),
            ),
          )
      : [];

  const combinationKey = (pairs: { valueId: string }[]) =>
    pairs
      .map((pair) => pair.valueId)
      .sort()
      .join("|");

  const existingKeys = new Set(
    existingVariants.map((variant) =>
      combinationKey(
        existingLinks
          .filter((link) => link.variantId === variant.id)
          .map((link) => ({ valueId: link.optionValueId })),
      ),
    ),
  );

  const takenSkus = new Set(existingVariants.map((variant) => variant.sku));
  const skuBase = product.slug.replace(/-/g, "").slice(0, 8).toUpperCase() || "SKU";

  let created = 0;

  for (const [index, combination] of combinations.entries()) {
    if (existingKeys.has(combinationKey(combination))) continue;

    let sku = `${skuBase}-${String(index + 1).padStart(3, "0")}`;
    let attempt = 1;
    while (takenSkus.has(sku)) {
      sku = `${skuBase}-${String(index + 1).padStart(3, "0")}-${attempt}`;
      attempt += 1;
    }
    takenSkus.add(sku);

    const title = combination
      .map((pair) => valueRows.find((value) => value.id === pair.valueId)?.value ?? "")
      .filter(Boolean)
      .join(" / ");

    const [variant] = await db
      .insert(variants)
      .values({
        productId: product.id,
        sku,
        title: title || "Default",
        priceMinor: input.priceMinor,
        stockQty: input.stockQty,
        position: index,
      })
      .returning({ id: variants.id });

    if (!variant) return { ok: false, error: "Could not create a variant." };

    await db.insert(variantOptionValues).values(
      combination.map((pair) => ({
        variantId: variant.id,
        optionId: pair.optionId,
        optionValueId: pair.valueId,
      })),
    );

    created += 1;
  }

  return { ok: true, created };
}
