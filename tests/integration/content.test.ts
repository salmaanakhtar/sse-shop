import { describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { products, users, variants } from "@/server/db/schema";
import {
  createHomeSection,
  deleteHomeSection,
  listHomeSections,
  loadHomeSections,
  moveHomeSection,
} from "@/server/services/home-sections";
import {
  createPage,
  deletePage,
  getPage,
  getPageBySlug,
  updatePage,
} from "@/server/services/pages";
import {
  getSettingRow,
  getStoreSettings,
  writeStoreSettings,
} from "@/server/services/settings";
import { createCollection, addCollectionProduct } from "@/server/services/collections";

const suffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function createProduct(title: string) {
  const [product] = await db
    .insert(products)
    .values({
      slug: `content-${suffix()}`,
      title,
      status: "active",
      publishedAt: new Date(),
    })
    .returning();
  if (!product) throw new Error("could not create the test product");

  await db.insert(variants).values({
    productId: product.id,
    sku: `CONTENT-${suffix()}`,
    title: "Default",
    priceMinor: 10_000,
    stockQty: 5,
  });

  return product;
}

describe("storefront content", () => {
  it("creates, orders, renders, and deletes homepage sections", async () => {
    const product = await createProduct("Home Product");
    const collection = await createCollection({
      name: "Home Collection",
      slug: `home-collection-${suffix()}`,
      description: "",
      active: true,
    });
    expect(collection.ok).toBe(true);
    if (!collection.ok) return;
    await addCollectionProduct(collection.data.id, product.id);

    const first = await createHomeSection({
      kind: "collection",
      title: "Featured",
      body: "",
      config: { collectionId: collection.data.id, limit: 4 },
      active: true,
    });
    const second = await createHomeSection({
      kind: "allProducts",
      title: "All products",
      body: "",
      config: { limit: 12 },
      active: true,
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect((await listHomeSections(true)).map((row) => row.id)).toEqual([
      first.data.id,
      second.data.id,
    ]);

    const views = await loadHomeSections();
    expect(views.map((view) => view.title)).toEqual(["Featured", "All products"]);
    expect(views[0]?.products.map((item) => item.id)).toEqual([product.id]);
    expect(views[1]?.products.map((item) => item.id)).toContain(product.id);

    expect(await moveHomeSection(second.data.id, "up")).toBe(true);
    expect((await listHomeSections(true)).map((row) => row.id)).toEqual([
      second.data.id,
      first.data.id,
    ]);

    expect((await deleteHomeSection(first.data.id)).ok).toBe(true);
    expect((await listHomeSections(true)).map((row) => row.id)).toEqual([second.data.id]);
  });

  it("creates, updates, publishes, and deletes a content page", async () => {
    const slug = `privacy-${suffix()}`;
    const created = await createPage({
      slug,
      title: "Privacy",
      body: "<p>Placeholder</p>",
      published: false,
      seoTitle: "",
      seoDescription: "",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(await getPageBySlug(slug)).toBeNull();

    expect(
      (
        await updatePage(created.data.id, {
          slug,
          title: "Privacy policy",
          body: "<p>Live</p>",
          published: true,
          seoTitle: "Privacy",
          seoDescription: "How we handle data",
        })
      ).ok,
    ).toBe(true);

    const page = await getPageBySlug(slug);
    expect(page?.title).toBe("Privacy policy");
    expect(page?.body).toContain("Live");
    expect((await getPage(created.data.id))?.published).toBe(true);

    expect((await deletePage(created.data.id)).ok).toBe(true);
    expect(await getPageBySlug(slug)).toBeNull();
  });

  it("writes typed store settings", async () => {
    const [user] = await db
      .insert(users)
      .values({ name: "Settings Admin", email: `settings-${suffix()}@example.com` })
      .returning();
    if (!user) throw new Error("could not create the settings user");

    const before = await getStoreSettings();
    await writeStoreSettings(
      {
        ...before,
        name: "Content Shop",
        announcementText: "Free delivery",
        announcementActive: true,
        themeBrand: "#112233",
        returnWindowDays: 21,
      },
      user.id,
    );

    const nameRow = await getSettingRow("store.name");
    const announcementRow = await getSettingRow("store.announcement_text");
    expect(nameRow?.value).toBe("Content Shop");
    expect(announcementRow?.value).toBe("Free delivery");
  });
});
