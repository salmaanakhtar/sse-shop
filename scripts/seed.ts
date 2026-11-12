import { eq } from "drizzle-orm";
import { db, sql } from "../src/server/db/client";
import {
  productOptionValues,
  productOptions,
  products,
  settings,
  variantOptionValues,
  variants,
} from "../src/server/db/schema";

const DEMO_SLUG = "essential-tee";

const SETTINGS: Record<string, unknown> = {
  "store.name": "sse-shop",
  "store.contact_email": "hello@example.com",
  "tax.rate_bp": 500,
  "tax.inclusive": true,
  "shipping.flat_rate_minor": 2000,
  "shipping.free_threshold_minor": 20000,
};

async function seedSettings() {
  for (const [key, value] of Object.entries(SETTINGS)) {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedAt: new Date() },
      });
  }
}

async function seedDemoProduct() {
  await db.delete(products).where(eq(products.slug, DEMO_SLUG));

  const [product] = await db
    .insert(products)
    .values({
      slug: DEMO_SLUG,
      title: "Essential Tee",
      description:
        "A plain cotton tee, cut for everyday wear. Seeded for development only.",
      status: "active",
      publishedAt: new Date(),
    })
    .returning({ id: products.id });

  if (!product) throw new Error("failed to insert the demo product");

  const optionSpec = [
    { name: "Size", values: ["S", "M"] },
    { name: "Colour", values: ["Black", "White"] },
  ] as const;

  const optionIds: { id: string; name: string }[] = [];
  const valueIds: { id: string; optionName: string; value: string }[] = [];

  for (const [position, option] of optionSpec.entries()) {
    const [row] = await db
      .insert(productOptions)
      .values({ productId: product.id, name: option.name, position })
      .returning({ id: productOptions.id });
    if (!row) throw new Error(`failed to insert option ${option.name}`);
    optionIds.push({ id: row.id, name: option.name });

    for (const [valuePosition, value] of option.values.entries()) {
      const [valueRow] = await db
        .insert(productOptionValues)
        .values({ optionId: row.id, value, position: valuePosition })
        .returning({ id: productOptionValues.id });
      if (!valueRow) throw new Error(`failed to insert option value ${value}`);
      valueIds.push({ id: valueRow.id, optionName: option.name, value });
    }
  }

  const sizeOption = optionIds.find((option) => option.name === "Size");
  const colourOption = optionIds.find((option) => option.name === "Colour");
  if (!sizeOption || !colourOption) throw new Error("demo options are incomplete");

  for (const [position, size] of ["S", "M"].entries()) {
    for (const [colourIndex, colour] of ["Black", "White"].entries()) {
      const sku = `TEE-${colour.slice(0, 3).toUpperCase()}-${size}`;
      const priceMinor = colour === "Black" ? 12_000 : 12_500;

      const [variant] = await db
        .insert(variants)
        .values({
          productId: product.id,
          sku,
          title: `${colour} / ${size}`,
          priceMinor,
          stockQty: 25,
          position: position * 2 + colourIndex,
        })
        .returning({ id: variants.id });
      if (!variant) throw new Error(`failed to insert variant ${sku}`);

      const sizeValue = valueIds.find((v) => v.optionName === "Size" && v.value === size);
      const colourValue = valueIds.find((v) => v.optionName === "Colour" && v.value === colour);
      if (!sizeValue || !colourValue) throw new Error("demo option values are incomplete");

      await db.insert(variantOptionValues).values([
        { variantId: variant.id, optionId: sizeOption.id, optionValueId: sizeValue.id },
        { variantId: variant.id, optionId: colourOption.id, optionValueId: colourValue.id },
      ]);
    }
  }

  console.info(`seeded ${DEMO_SLUG}: ${optionSpec.length} options, 4 variants`);
}

async function main() {
  console.info("seeding…");
  await seedSettings();
  await seedDemoProduct();
  console.info("done");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
