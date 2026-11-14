import { eq } from "drizzle-orm";
import { db, sql } from "../src/server/db/client";
import {
  badges,
  categories,
  collectionProducts,
  collections,
  homeSections,
  pages,
  productBadges,
  shippingBands,
  shippingZones,
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
  "store.contact_phone": "+971 50 123 4567",
  "store.address": "Dubai, United Arab Emirates",
  "store.legal_name": "sse-shop Trading LLC",
  "store.trn": "",
  "tax.rate_bp": 500,
  "tax.inclusive": true,
  "shipping.flat_rate_minor": 2000,
  "shipping.free_threshold_minor": 20000,
  "returns.window_days": 14,
  "inventory.low_stock_threshold": 5,
  "cart.abandoned_hours": 4,
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
          weightGrams: 250,
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
      weightGrams: 100,
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
  const [apparel] = await db
    .insert(categories)
    .values({
      name: "Apparel",
      slug: "apparel",
      description: "Everyday clothing, cut for the UAE climate.",
      position: 0,
    })
    .onConflictDoUpdate({
      target: categories.slug,
      set: {
        name: "Apparel",
        description: "Everyday clothing, cut for the UAE climate.",
        parentId: null,
        position: 0,
        active: true,
        updatedAt: new Date(),
      },
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
    .onConflictDoUpdate({
      target: categories.slug,
      set: {
        name: "Tops",
        description: "Tees and layers.",
        parentId: apparel?.id ?? null,
        position: 0,
        active: true,
        updatedAt: new Date(),
      },
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
    .onConflictDoUpdate({
      target: categories.slug,
      set: {
        name: "Accessories",
        description: "The finishing pieces.",
        parentId: null,
        position: 1,
        active: true,
        updatedAt: new Date(),
      },
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
    .onConflictDoUpdate({
      target: collections.slug,
      set: {
        name: "Featured",
        description: "A short edit of pieces we reach for.",
        position: 0,
        active: true,
        updatedAt: new Date(),
      },
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
    .onConflictDoUpdate({
      target: collections.slug,
      set: {
        name: "Daily Offers",
        description: "Small prices for the everyday.",
        position: 1,
        active: true,
        updatedAt: new Date(),
      },
    })
    .returning({ id: collections.id });

  if (featured) {
    const rows = [tee?.id, cap?.id]
      .filter((id): id is string => Boolean(id))
      .map((productId, position) => ({ collectionId: featured.id, productId, position }));
    for (const row of rows) {
      await db
        .insert(collectionProducts)
        .values(row)
        .onConflictDoUpdate({
          target: [collectionProducts.collectionId, collectionProducts.productId],
          set: { position: row.position },
        });
    }
  }
  if (daily && cap) {
    await db
      .insert(collectionProducts)
      .values({ collectionId: daily.id, productId: cap.id, position: 0 })
      .onConflictDoUpdate({
        target: [collectionProducts.collectionId, collectionProducts.productId],
        set: { position: 0 },
      });
  }

  const [bestSeller] = await db
    .insert(badges)
    .values({ label: "Best Seller", tone: "brand", position: 0 })
    .onConflictDoUpdate({
      target: badges.label,
      set: { tone: "brand", position: 0, active: true, updatedAt: new Date() },
    })
    .returning({ id: badges.id });
  const [newBadge] = await db
    .insert(badges)
    .values({ label: "New", tone: "success", position: 1 })
    .onConflictDoUpdate({
      target: badges.label,
      set: { tone: "success", position: 1, active: true, updatedAt: new Date() },
    })
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

const SHIPPING_ZONES: {
  emirate: string;
  freeThresholdMinor: number;
  bands: [number, number | null, number][];
}[] = [
  {
    emirate: "Abu Dhabi",
    freeThresholdMinor: 25_000,
    bands: [
      [0, 2_000, 2_500],
      [2_001, 5_000, 3_500],
      [5_001, null, 4_500],
    ],
  },
  {
    emirate: "Dubai",
    freeThresholdMinor: 20_000,
    bands: [
      [0, 2_000, 2_000],
      [2_001, 5_000, 3_000],
      [5_001, null, 4_000],
    ],
  },
  {
    emirate: "Sharjah",
    freeThresholdMinor: 20_000,
    bands: [
      [0, 2_000, 2_000],
      [2_001, 5_000, 3_000],
      [5_001, null, 4_000],
    ],
  },
  {
    emirate: "Ajman",
    freeThresholdMinor: 20_000,
    bands: [
      [0, 2_000, 2_000],
      [2_001, 5_000, 3_000],
      [5_001, null, 4_000],
    ],
  },
  {
    emirate: "Umm Al Quwain",
    freeThresholdMinor: 30_000,
    bands: [
      [0, 2_000, 3_000],
      [2_001, 5_000, 4_000],
      [5_001, null, 5_000],
    ],
  },
  {
    emirate: "Ras Al Khaimah",
    freeThresholdMinor: 30_000,
    bands: [
      [0, 2_000, 3_000],
      [2_001, 5_000, 4_000],
      [5_001, null, 5_000],
    ],
  },
  {
    emirate: "Fujairah",
    freeThresholdMinor: 30_000,
    bands: [
      [0, 2_000, 3_000],
      [2_001, 5_000, 4_000],
      [5_001, null, 5_000],
    ],
  },
];

async function seedShippingZones() {
  for (const [index, zone] of SHIPPING_ZONES.entries()) {
    const [row] = await db
      .insert(shippingZones)
      .values({
        emirate: zone.emirate,
        name: zone.emirate,
        freeThresholdMinor: zone.freeThresholdMinor,
        active: true,
        position: index,
      })
      .onConflictDoUpdate({
        target: shippingZones.emirate,
        set: { freeThresholdMinor: zone.freeThresholdMinor, updatedAt: new Date() },
      })
      .returning({ id: shippingZones.id });
    if (!row) throw new Error(`failed to seed the ${zone.emirate} shipping zone`);

    const [existing] = await db
      .select({ id: shippingBands.id })
      .from(shippingBands)
      .where(eq(shippingBands.zoneId, row.id))
      .limit(1);
    if (existing) continue;

    await db.insert(shippingBands).values(
      zone.bands.map(([min, max, rate], position) => ({
        zoneId: row.id,
        minWeightGrams: min,
        maxWeightGrams: max,
        rateMinor: rate,
        position,
      })),
    );
  }

  console.info("seeded shipping zones and weight bands");
}

async function seedLegalPages() {
  const existing = await db.select({ slug: pages.slug }).from(pages);
  const existingSlugs = new Set(existing.map((row) => row.slug));

  const legalPages = [
    {
      slug: "privacy",
      title: "Privacy policy",
      seoDescription: "How sse-shop collects, uses, and protects personal data.",
      body: `<h2>Privacy policy</h2>
<p>This is placeholder policy text for [BUSINESS NAME]. Replace it with your reviewed policy before launch.</p>
<p>We collect the information needed to process orders, deliver goods, provide support, and meet our legal obligations. We do not sell personal data.</p>
<h3>Your choices</h3>
<p>You can request access, correction, or deletion of your personal data by contacting [CONTACT EMAIL]. Orders may be retained where required for accounting and tax records.</p>
<h3>Cookies</h3>
<p>We use essential cookies for sign-in, carts, preferences, and security. Analytics or marketing cookies are only used with the appropriate consent.</p>`,
    },
    {
      slug: "terms",
      title: "Terms of service",
      seoDescription: "The terms that apply when you use the sse-shop storefront.",
      body: `<h2>Terms of service</h2>
<p>These are placeholder terms for [BUSINESS NAME]. Replace them with your reviewed terms before launch.</p>
<p>By placing an order you confirm that the information you provide is accurate and that you are able to enter into a contract. Prices are shown in AED and include VAT where stated.</p>
<p>We may refuse or cancel an order where stock, pricing, payment, fraud, or legal checks require it. Any accepted payment is refunded to the original method when possible.</p>`,
    },
    {
      slug: "shipping",
      title: "Shipping and delivery",
      seoDescription: "Delivery areas, times, and charges.",
      body: `<h2>Shipping and delivery</h2>
<p>This is placeholder shipping content for [BUSINESS NAME]. Replace it with your final service levels before launch.</p>
<p>We deliver across the United Arab Emirates. Delivery charges and free-delivery thresholds are shown at checkout and may vary by emirate and order weight.</p>
<p>Delivery estimates are not guarantees. Delays caused by carriers, weather, customs, or events outside our control may affect the estimated date.</p>`,
    },
    {
      slug: "returns",
      title: "Returns and refunds",
      seoDescription: "How to return an item and request a refund.",
      body: `<h2>Returns and refunds</h2>
<p>This is placeholder returns content for [BUSINESS NAME]. Replace it with your final policy before launch.</p>
<p>You may request a return within [RETURN WINDOW] days of delivery, provided the item is unused and in its original condition. Some items may be excluded for hygiene or safety reasons.</p>
<p>Approved returns are refunded to the original payment method after inspection. Delivery charges are refunded only where the return is due to our error or a faulty item.</p>`,
    },
    {
      slug: "contact",
      title: "Contact us",
      seoDescription: "How to reach the sse-shop team.",
      body: `<h2>Contact us</h2>
<p>For order questions, returns, or product help, email <a href="mailto:[CONTACT EMAIL]">[CONTACT EMAIL]</a>.</p>
<p>Registered address: [ADDRESS]</p>
<p>TRN: [TRN]</p>`,
    },
    {
      slug: "faq",
      title: "Frequently asked questions",
      seoDescription: "Answers to common shopping and delivery questions.",
      body: `<h2>Frequently asked questions</h2>
<h3>How do I track my order?</h3>
<p>Use the order link in your confirmation email, or sign in and open your order history.</p>
<h3>Can I change my order?</h3>
<p>Contact us as soon as possible. Once an order is fulfilled, changes may need to go through the returns process.</p>
<h3>Do prices include VAT?</h3>
<p>Yes. Prices are shown in AED and include VAT where stated. The VAT component is shown at checkout and on the order.</p>`,
    },
    {
      slug: "cookies",
      title: "Cookie policy",
      seoDescription: "The cookies used by the sse-shop storefront.",
      body: `<h2>Cookie policy</h2>
<p>This is placeholder cookie content for [BUSINESS NAME]. Replace it with your reviewed policy before launch.</p>
<p>Essential cookies keep you signed in, preserve your cart, remember storefront preferences, and protect forms. They are required for the store to work.</p>
<p>Analytics and marketing cookies are optional and are only used where consent has been collected.</p>`,
    },
  ];

  for (const page of legalPages) {
    if (existingSlugs.has(page.slug)) continue;
    await db.insert(pages).values({
      slug: page.slug,
      title: page.title,
      body: page.body,
      published: true,
      seoTitle: page.title,
      seoDescription: page.seoDescription,
    });
  }

  console.info("seeded legal pages");
}

async function seedHomeContent() {
  const [existing] = await db.select({ id: homeSections.id }).from(homeSections).limit(1);
  if (existing) return;

  const collectionRows = await db
    .select({ id: collections.id, slug: collections.slug, name: collections.name })
    .from(collections);
  const featured = collectionRows.find((row) => row.slug === "featured");
  const daily = collectionRows.find((row) => row.slug === "daily-offers");

  const sections: (typeof homeSections.$inferInsert)[] = [
    {
      kind: "promotions",
      title: "Promotions",
      position: 0,
      active: true,
    },
    {
      kind: "hero",
      title: "Considered goods, delivered across the UAE.",
      body: "Free delivery over AED 200. Every price includes 5% VAT.",
      position: 1,
      active: true,
    },
  ];

  if (featured) {
    sections.push({
      kind: "collection",
      title: featured.name,
      config: { collectionId: featured.id, limit: 4 },
      position: sections.length,
      active: true,
    });
  }
  if (daily) {
    sections.push({
      kind: "collection",
      title: daily.name,
      config: { collectionId: daily.id, limit: 4 },
      position: sections.length,
      active: true,
    });
  }

  sections.push({
    kind: "allProducts",
    title: "All products",
    config: { limit: 24 },
    position: sections.length,
    active: true,
  });

  await db.insert(homeSections).values(sections);
  console.info("seeded homepage sections");
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
  await seedShippingZones();
  await seedLegalPages();
  await seedHomeContent();
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
