import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import {
  cartItems,
  carts,
  lowStockAlerts,
  products,
  stockAlerts,
  users,
  variants,
} from "@/server/db/schema";
import { mailer } from "@/server/mail";
import {
  countAbandonedCarts,
  countPendingStockAlerts,
  processStockChanges,
  sendAbandonedCartEmails,
  subscribeToStockAlert,
} from "@/server/services/notifications";

const suffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function createProduct(stockQty: number, lowStockThreshold?: number) {
  const [product] = await db
    .insert(products)
    .values({
      slug: `notify-${suffix()}`,
      title: "Notify Product",
      status: "active",
      publishedAt: new Date(),
    })
    .returning();
  if (!product) throw new Error("could not create the test product");

  const [variant] = await db
    .insert(variants)
    .values({
      productId: product.id,
      sku: `NOTIFY-${suffix()}`,
      title: "Default",
      priceMinor: 9_000,
      stockQty,
      lowStockThreshold: lowStockThreshold ?? null,
    })
    .returning();
  if (!variant) throw new Error("could not create the test variant");

  return { product, variant };
}

async function createUser(marketingConsent = false) {
  const [user] = await db
    .insert(users)
    .values({
      name: "Notify Customer",
      email: `notify-${suffix()}@example.com`,
      marketingConsent,
      marketingConsentAt: marketingConsent ? new Date() : null,
    })
    .returning();
  if (!user) throw new Error("could not create the test user");
  return user;
}

describe("stock notifications", () => {
  it("captures one back-in-stock request and sends once after restock", async () => {
    const { product, variant } = await createProduct(0);
    const email = `waiting-${suffix()}@example.com`;

    expect(await subscribeToStockAlert({ variantId: variant.id, email })).toEqual({
      ok: true,
      data: { status: "subscribed" },
    });
    expect(await subscribeToStockAlert({ variantId: variant.id, email })).toEqual({
      ok: true,
      data: { status: "subscribed" },
    });
    expect(await countPendingStockAlerts()).toBe(1);

    await db.update(variants).set({ stockQty: 4 }).where(eq(variants.id, variant.id));

    const send = vi.spyOn(mailer, "send").mockResolvedValue(undefined);
    const result = await processStockChanges([variant.id]);

    expect(result.backInStock).toBe(1);
    expect(result.lowStock).toBe(1);
    // One back-in-stock message and one low-stock alert to the store.
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[0].to).toBe(email);
    expect(send.mock.calls[0]?.[0].subject).toContain("back in stock");
    expect(await countPendingStockAlerts()).toBe(0);

    await processStockChanges([variant.id]);
    expect(send).toHaveBeenCalledTimes(2);
    expect(product.id).toBeTruthy();

    send.mockRestore();

    const [row] = await db.select().from(stockAlerts).where(eq(stockAlerts.variantId, variant.id));
    expect(row?.notifiedAt).toBeInstanceOf(Date);
  });

  it("refuses a request for an item already in stock", async () => {
    const { variant } = await createProduct(3);

    const result = await subscribeToStockAlert({
      variantId: variant.id,
      email: `instock-${suffix()}@example.com`,
    });
    expect(result).toEqual({ ok: true, data: { status: "in_stock" } });
  });

  it("sends one low-stock alert per crossing and resets after restock", async () => {
    const { variant } = await createProduct(1);
    const send = vi.spyOn(mailer, "send").mockResolvedValue(undefined);

    const first = await processStockChanges([variant.id]);
    expect(first.lowStock).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0].subject).toContain("Low stock");

    const repeated = await processStockChanges([variant.id]);
    expect(repeated.lowStock).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);

    // Above the global threshold of 5: the open alert is cleared.
    await db.update(variants).set({ stockQty: 20 }).where(eq(variants.id, variant.id));
    await processStockChanges([variant.id]);
    expect(await db.select().from(lowStockAlerts).where(eq(lowStockAlerts.variantId, variant.id))).toHaveLength(0);

    // A second crossing alerts once more.
    await db.update(variants).set({ stockQty: 0 }).where(eq(variants.id, variant.id));
    const second = await processStockChanges([variant.id]);
    expect(second.lowStock).toBe(1);
    expect(send).toHaveBeenCalledTimes(2);

    send.mockRestore();
  });

  it("honours a per-variant low-stock threshold", async () => {
    const { variant } = await createProduct(12, 15);
    const send = vi.spyOn(mailer, "send").mockResolvedValue(undefined);

    const result = await processStockChanges([variant.id]);
    expect(result.lowStock).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);

    send.mockRestore();
  });

  it("emails an abandoned signed-in cart once, only with consent", async () => {
    const user = await createUser(true);
    const { variant } = await createProduct(5);
    const old = new Date(Date.now() - 6 * 60 * 60 * 1000);

    const [cart] = await db
      .insert(carts)
      .values({
        tokenHash: `cart-${suffix()}`,
        userId: user.id,
        expiresAt: new Date(Date.now() + 86_400_000),
        updatedAt: old,
      })
      .returning();
    if (!cart) throw new Error("could not create the test cart");
    await db
      .insert(cartItems)
      .values({ cartId: cart.id, variantId: variant.id, quantity: 2, updatedAt: old });

    const quietUser = await createUser(false);
    const [quietCart] = await db
      .insert(carts)
      .values({
        tokenHash: `cart-${suffix()}`,
        userId: quietUser.id,
        expiresAt: new Date(Date.now() + 86_400_000),
        updatedAt: old,
      })
      .returning();
    if (!quietCart) throw new Error("could not create the quiet cart");
    await db
      .insert(cartItems)
      .values({ cartId: quietCart.id, variantId: variant.id, quantity: 1, updatedAt: old });

    expect(await countAbandonedCarts()).toBe(1);

    const send = vi.spyOn(mailer, "send").mockResolvedValue(undefined);
    const first = await sendAbandonedCartEmails();

    expect(first.sent).toBe(1);
    expect(send.mock.calls[0]?.[0].to).toBe(user.email);
    expect(send.mock.calls[0]?.[0].text).toContain("Notify Product");
    expect(await countAbandonedCarts()).toBe(0);

    const second = await sendAbandonedCartEmails();
    expect(second.sent).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);

    send.mockRestore();
  });
});
