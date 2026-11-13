import { asc, eq, inArray } from "drizzle-orm";
import { buildCombinations, combinationKey } from "@/lib/variants";
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

  const options = optionRows.map((option) => ({
    id: option.id,
    name: option.name,
    values: valueRows
      .filter((value) => value.optionId === option.id)
      .map((value) => ({ id: value.id, value: value.value })),
  }));

  const incomplete = options.find((option) => option.values.length === 0);
  if (incomplete) return { ok: false, error: `"${incomplete.name}" has no values yet.` };

  const combinations = buildCombinations(options);
  const optionIdByValue = new Map(
    options.flatMap((option) =>
      option.values.map((value) => [value.id, option.id] as const),
    ),
  );

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

  const existingKeys = new Set(
    existingVariants.map((variant) =>
      combinationKey(
        existingLinks
          .filter((link) => link.variantId === variant.id)
          .map((link) => link.optionValueId),
      ),
    ),
  );

  const takenSkus = new Set(existingVariants.map((variant) => variant.sku));
  const skuBase = product.slug.replace(/-/g, "").slice(0, 8).toUpperCase() || "SKU";

  let created = 0;

  for (const [index, combination] of combinations.entries()) {
    if (existingKeys.has(combination.key)) continue;

    let sku = `${skuBase}-${String(index + 1).padStart(3, "0")}`;
    let attempt = 1;
    while (takenSkus.has(sku)) {
      sku = `${skuBase}-${String(index + 1).padStart(3, "0")}-${attempt}`;
      attempt += 1;
    }
    takenSkus.add(sku);

    const [variant] = await db
      .insert(variants)
      .values({
        productId: product.id,
        sku,
        title: combination.labels.join(" / ") || "Default",
        priceMinor: input.priceMinor,
        stockQty: input.stockQty,
        position: index,
      })
      .returning({ id: variants.id });

    if (!variant) return { ok: false, error: "Could not create a variant." };

    const links = combination.optionValueIds.map((valueId) => {
      const optionId = optionIdByValue.get(valueId);
      if (!optionId) throw new Error("A generated combination lost its option.");
      return { variantId: variant.id, optionId, optionValueId: valueId };
    });

    await db.insert(variantOptionValues).values(links);

    created += 1;
  }

  return { ok: true, created };
}
