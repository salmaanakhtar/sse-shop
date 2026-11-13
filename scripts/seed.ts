import { eq, inArray } from "drizzle-orm";
import { db, sql } from "../src/server/db/client";
import {
  badges,
  categories,
  collectionProducts,
  collections,
  productBadges,
  productCategories,
  productOptionValues,
  productOptions,
  products,
  settings,
  users,
  variantNodes,
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
    { name: "Colour", values: ["Black", "White"] },
    { name: "Size", values: ["S", "M"] },
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

  for (const [colourIndex, colour] of ["Black", "White"].entries()) {
    const colourValue = valueIds.find((v) => v.optionName === "Colour" && v.value === colour);
    if (!colourValue) throw new Error("demo colour values are incomplete");

    const priceMinor = colour === "Black" ? 12_000 : 12_500;

    const [root] = await db
      .insert(variantNodes)
      .values({
        productId: product.id,
        parentId: null,
        optionId: colourOption.id,
        optionValueId: colourValue.id,
        label: colour,
        position: colourIndex,
        active: true,
        defaultPriceMinor: priceMinor,
        defaultStockQty: 25,
      })
      .returning({ id: variantNodes.id });

    if (!root) throw new Error(`failed to insert the ${colour} branch`);

    for (const [sizeIndex, size] of ["S", "M"].entries()) {
      const sizeValue = valueIds.find((v) => v.optionName === "Size" && v.value === size);
      if (!sizeValue) throw new Error("demo size values are incomplete");

      const sku = `TEE-${colour.slice(0, 3).toUpperCase()}-${size}`;

      const [variant] = await db
        .insert(variants)
        .values({
          productId: product.id,
          sku,
          title: `${colour} / ${size}`,
          priceMinor,
          stockQty: 25,
          position: colourIndex * 2 + sizeIndex,
        })
        .returning({ id: variants.id });

      if (!variant) throw new Error(`failed to insert variant ${sku}`);

      await db.insert(variantNodes).values({
        productId: product.id,
        parentId: root.id,
        optionId: sizeOption.id,
        optionValueId: sizeValue.id,
        label: size,
        position: sizeIndex,
        active: true,
        defaultPriceMinor: priceMinor,
        defaultStockQty: 25,
        variantId: variant.id,
      });
    }
  }

  console.info(`seeded ${DEMO_SLUG}: ${optionSpec.length} levels, 4 leaf variants`);
}

async function seedLowStockProduct() {
  await db.delete(products).where(eq(products.slug, "sample-cap"));

  const [product] = await db
    .insert(products)
    .values({
      slug: "sample-cap",
      title: "Sample Cap",
      description: "Single-variant product seeded for development. Two in stock.",
      status: "active",
      publishedAt: new Date(),
    })
    .returning({ id: products.id });

  if (!product) throw new Error("failed to insert the low-stock product");

  const [variant] = await db
    .insert(variants)
    .values({
      productId: product.id,
      sku: "CAP-ONE",
      title: "Default",
      priceMinor: 4_500,
      stockQty: 2,
    })
    .returning({ id: variants.id });

  if (!variant) throw new Error("failed to insert the low-stock variant");

  await db.insert(variantNodes).values({
    productId: product.id,
    parentId: null,
    optionId: null,
    optionValueId: null,
    label: "Default",
    position: 0,
    active: true,
    defaultPriceMinor: 4_500,
    defaultStockQty: 2,
    variantId: variant.id,
  });
}

async function seedTaxonomy() {
  await db
    .delete(categories)
    .where(inArray(categories.slug, ["apparel", "tops", "accessories"]));
  await db
    .delete(collections)
    .where(inArray(collections.slug, ["featured", "daily-offers"]));
  await db.delete(badges).where(inArray(badges.label, ["Best Seller", "New"]));

  const [apparel] = await db
    .insert(categories)
    .values({
      name: "Apparel",
      slug: "apparel",
      description: "Everyday clothing, cut for the UAE climate.",
      position: 0,
    })
    .returning({ id: categories.id });
  const [tops] = await db
    .insert(categories)
    .values({
      name: "Tops",
      slug: "tops",
      description: "Tees and layers.",
      parentId: apparel?.id ?? null,
      position: 0,
    })
    .returning({ id: categories.id });
  const [accessories] = await db
    .insert(categories)
    .values({
      name: "Accessories",
      slug: "accessories",
      description: "The finishing pieces.",
      position: 1,
    })
    .returning({ id: categories.id });

  const [tee] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.slug, DEMO_SLUG))
    .limit(1);
  const [cap] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.slug, "sample-cap"))
    .limit(1);

  if (tops && tee) {
    await db
      .insert(productCategories)
      .values({ productId: tee.id, categoryId: tops.id })
      .onConflictDoNothing();
  }
  if (accessories && cap) {
    await db
      .insert(productCategories)
      .values({ productId: cap.id, categoryId: accessories.id })
      .onConflictDoNothing();
  }

  const [featured] = await db
    .insert(collections)
    .values({
      name: "Featured",
      slug: "featured",
      description: "A short edit of pieces we reach for.",
      position: 0,
    })
    .returning({ id: collections.id });
  const [daily] = await db
    .insert(collections)
    .values({
      name: "Daily Offers",
      slug: "daily-offers",
      description: "Small prices for the everyday.",
      position: 1,
    })
    .returning({ id: collections.id });

  if (featured) {
    const rows = [tee?.id, cap?.id]
      .filter((id): id is string => Boolean(id))
      .map((productId, position) => ({ collectionId: featured.id, productId, position }));
    if (rows.length > 0) {
      await db.insert(collectionProducts).values(rows).onConflictDoNothing();
    }
  }
  if (daily && cap) {
    await db
      .insert(collectionProducts)
      .values({ collectionId: daily.id, productId: cap.id, position: 0 })
      .onConflictDoNothing();
  }

  const [bestSeller] = await db
    .insert(badges)
    .values({ label: "Best Seller", tone: "brand", position: 0 })
    .returning({ id: badges.id });
  const [newBadge] = await db
    .insert(badges)
    .values({ label: "New", tone: "success", position: 1 })
    .returning({ id: badges.id });

  if (bestSeller && tee) {
    await db
      .insert(productBadges)
      .values({ productId: tee.id, badgeId: bestSeller.id })
      .onConflictDoNothing();
  }
  if (newBadge && cap) {
    await db
      .insert(productBadges)
      .values({ productId: cap.id, badgeId: newBadge.id })
      .onConflictDoNothing();
  }

  console.info("seeded categories, collections, and badges");
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn("ADMIN_EMAIL or ADMIN_PASSWORD is unset; skipping the admin user.");
    return;
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existing) {
    if (existing.role !== "admin") {
      await db.update(users).set({ role: "admin" }).where(eq(users.id, existing.id));
    }
    console.info(`admin ${email} already exists`);
    return;
  }

  const { auth } = await import("../src/server/auth");
  await auth.api.signUpEmail({ body: { email, password, name: "Store owner" } });
  await db.update(users).set({ role: "admin" }).where(eq(users.email, email));

  console.info(`created admin ${email} — enrol TOTP on first sign-in`);
}

async function main() {
  console.info("seeding…");
  await seedSettings();
  await seedAdmin();
  await seedDemoProduct();
  await seedLowStockProduct();
  await seedTaxonomy();
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
