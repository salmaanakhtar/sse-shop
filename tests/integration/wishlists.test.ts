import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import {
  products,
  users,
  variants,
  wishlistAlerts,
} from "@/server/db/schema";
import { mailer } from "@/server/mail";
import {
  checkWishlistPriceDropsForUser,
  createWishlist,
  deleteWishlist,
  ensureDefaultWishlist,
  getWishlistStateForProduct,
  listWishlistItems,
  listWishlists,
  removeWishlistItem,
  renameWishlist,
  setVariantWishlists,
} from "@/server/services/wishlists";

const suffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function createUser() {
  const [user] = await db
    .insert(users)
    .values({
      name: "Wishlist Tester",
      email: `wishlist-${suffix()}@example.com`,
    })
    .returning();
  if (!user) throw new Error("could not create the test user");
  return user;
}

async function createProductWithVariant(priceMinor = 10_000) {
  const [product] = await db
    .insert(products)
    .values({
      slug: `wishlist-product-${suffix()}`,
      title: "Wishlist Product",
      status: "active",
      publishedAt: new Date(),
    })
    .returning();
  if (!product) throw new Error("could not create the test product");

  const [variant] = await db
    .insert(variants)
    .values({
      productId: product.id,
      sku: `WISH-${suffix()}`,
      title: "Black / M",
      priceMinor,
      stockQty: 5,
    })
    .returning();
  if (!variant) throw new Error("could not create the test variant");

  return { product, variant };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("wishlists", () => {
  it("creates one default Saved list and supports named lists", async () => {
    const user = await createUser();

    const first = await ensureDefaultWishlist(user.id);
    const second = await ensureDefaultWishlist(user.id);
    expect(first.id).toBe(second.id);
    expect(first.name).toBe("Saved");
    expect(first.isDefault).toBe(true);

    const named = await createWishlist(user.id, "Gifts");
    expect(named.ok).toBe(true);
    if (!named.ok) return;

    expect((await createWishlist(user.id, "gifts")).ok).toBe(false);
    expect((await renameWishlist(user.id, named.data.id, "Eid gifts")).ok).toBe(true);
    expect((await deleteWishlist(user.id, first.id)).ok).toBe(false);

    const lists = await listWishlists(user.id);
    expect(lists.map((list) => [list.name, list.isDefault])).toEqual([
      ["Saved", true],
      ["Eid gifts", false],
    ]);

    expect((await deleteWishlist(user.id, named.data.id)).ok).toBe(true);
    expect((await listWishlists(user.id)).map((list) => list.name)).toEqual(["Saved"]);
  });

  it("saves a variant across lists, keeps the first saved price, and clears items", async () => {
    const user = await createUser();
    const { product, variant } = await createProductWithVariant(10_000);
    const saved = await ensureDefaultWishlist(user.id);
    const named = await createWishlist(user.id, "Gifts");
    expect(named.ok).toBe(true);
    if (!named.ok) return;

    expect((await setVariantWishlists(user.id, variant.id, [saved.id])).ok).toBe(true);
    let state = await getWishlistStateForProduct(user.id, product.id);
    expect(state.memberships[variant.id]).toEqual([saved.id]);

    expect(
      (await setVariantWishlists(user.id, variant.id, [saved.id, named.data.id])).ok,
    ).toBe(true);
    state = await getWishlistStateForProduct(user.id, product.id);
    expect(state.memberships[variant.id]?.sort()).toEqual([saved.id, named.data.id].sort());

    const items = await listWishlistItems(user.id, saved.id);
    expect(items[0]?.addedPriceMinor).toBe(10_000);
    expect(items[0]?.available).toBe(true);

    expect((await setVariantWishlists(user.id, variant.id, [named.data.id])).ok).toBe(true);
    state = await getWishlistStateForProduct(user.id, product.id);
    expect(state.memberships[variant.id]).toEqual([named.data.id]);

    expect((await removeWishlistItem(user.id, named.data.id, variant.id)).ok).toBe(true);
    state = await getWishlistStateForProduct(user.id, product.id);
    expect(state.memberships[variant.id]).toBeUndefined();
    expect(await listWishlistItems(user.id, named.data.id)).toEqual([]);
  });

  it("sends exactly one price-drop mail per variant and resets after removal", async () => {
    const user = await createUser();
    const { product, variant } = await createProductWithVariant(10_000);
    const saved = await ensureDefaultWishlist(user.id);
    const named = await createWishlist(user.id, "Gifts");
    expect(named.ok).toBe(true);
    if (!named.ok) return;

    await setVariantWishlists(user.id, variant.id, [saved.id]);
    await db
      .update(variants)
      .set({ priceMinor: 8_000, updatedAt: new Date() })
      .where(eq(variants.id, variant.id));

    const send = vi.spyOn(mailer, "send").mockResolvedValue(undefined);

    await checkWishlistPriceDropsForUser(user.id);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0].subject).toBe(`Price drop: ${product.title}`);
    expect(send.mock.calls[0]?.[0].text).toMatch(/Now: AED\s80\.00/);

    await checkWishlistPriceDropsForUser(user.id);
    expect(send).toHaveBeenCalledTimes(1);

    await setVariantWishlists(user.id, variant.id, [saved.id, named.data.id]);
    await checkWishlistPriceDropsForUser(user.id);
    expect(send).toHaveBeenCalledTimes(1);

    await setVariantWishlists(user.id, variant.id, []);
    expect(
      await db
        .select()
        .from(wishlistAlerts)
        .where(and(eq(wishlistAlerts.userId, user.id), eq(wishlistAlerts.variantId, variant.id))),
    ).toHaveLength(0);

    await setVariantWishlists(user.id, variant.id, [saved.id]);
    await db
      .update(variants)
      .set({ priceMinor: 7_000, updatedAt: new Date() })
      .where(eq(variants.id, variant.id));

    await checkWishlistPriceDropsForUser(user.id);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("counts an active sale as a price drop and cleans alerts when a list is deleted", async () => {
    const user = await createUser();
    const { variant } = await createProductWithVariant(10_000);
    const named = await createWishlist(user.id, "Gifts");
    expect(named.ok).toBe(true);
    if (!named.ok) return;

    await setVariantWishlists(user.id, variant.id, [named.data.id]);
    await db
      .update(variants)
      .set({
        salePriceMinor: 9_000,
        saleStartsAt: new Date("2026-01-01T00:00:00.000Z"),
        saleEndsAt: new Date("2030-01-01T00:00:00.000Z"),
        updatedAt: new Date(),
      })
      .where(eq(variants.id, variant.id));

    const send = vi.spyOn(mailer, "send").mockResolvedValue(undefined);
    await checkWishlistPriceDropsForUser(user.id);
    expect(send).toHaveBeenCalledTimes(1);

    expect((await deleteWishlist(user.id, named.data.id)).ok).toBe(true);
    expect(
      await db
        .select()
        .from(wishlistAlerts)
        .where(and(eq(wishlistAlerts.userId, user.id), eq(wishlistAlerts.variantId, variant.id))),
    ).toHaveLength(0);
  });
});
