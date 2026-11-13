import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { auditLog, orders, users } from "@/server/db/schema";
import {
  createAddress,
  deleteAddress,
  getAddress,
  getDefaultAddress,
  listAddresses,
  updateAddress,
} from "@/server/services/addresses";
import { anonymizeCustomer, getCustomerForAdmin } from "@/server/services/customers";
import {
  claimOrder,
  getOrderForCustomer,
  hashLookupToken,
  listOrdersForCustomer,
} from "@/server/services/orders";

const address = {
  fullName: "Ayesha Khan",
  phone: "+971501234567",
  emirate: "Dubai" as const,
  street: "Al Wasl Road",
  building: "Villa 12",
  area: "Jumeirah 1",
  poBox: "",
  notes: "",
};

async function createCustomer(label: string) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [user] = await db
    .insert(users)
    .values({
      name: `Test ${label}`,
      email: `${label}-${suffix}@example.com`,
      role: "customer",
    })
    .returning();

  if (!user) throw new Error("could not create the test customer");
  return user;
}

async function createOrder(userId: string | null, token: string, email = "guest@example.com") {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [order] = await db
    .insert(orders)
    .values({
      number: `SS-2026-${suffix}`,
      lookupTokenHash: hashLookupToken(token),
      lookupExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      userId,
      email,
      status: "confirmed",
      paymentStatus: "paid",
      subtotalMinor: 1_000,
      totalMinor: 1_000,
      shippingAddress: address,
      billingAddress: address,
    })
    .returning();

  if (!order) throw new Error("could not create the test order");
  return order;
}

describe("saved addresses", () => {
  it("makes the first address the default for delivery and billing", async () => {
    const user = await createCustomer("address-first");
    const created = await createAddress(user.id, { ...address, label: "Home" });

    expect(created.isDefaultShipping).toBe(true);
    expect(created.isDefaultBilling).toBe(true);
    expect((await getDefaultAddress(user.id, "shipping"))?.id).toBe(created.id);
    expect((await getDefaultAddress(user.id, "billing"))?.id).toBe(created.id);
  });

  it("moves a default without leaving two defaults behind", async () => {
    const user = await createCustomer("address-defaults");
    const first = await createAddress(user.id, { ...address, label: "Home" });
    const second = await createAddress(user.id, {
      ...address,
      label: "Office",
      building: "Tower 2",
      isDefaultShipping: true,
    });

    const addresses = await listAddresses(user.id);
    const firstAfter = addresses.find((row) => row.id === first.id);
    const secondAfter = addresses.find((row) => row.id === second.id);

    expect(secondAfter?.isDefaultShipping).toBe(true);
    expect(firstAfter?.isDefaultShipping).toBe(false);
    expect(firstAfter?.isDefaultBilling).toBe(true);
    expect(secondAfter?.isDefaultBilling).toBe(false);

    await updateAddress(user.id, first.id, { ...address, isDefaultShipping: true });
    expect((await getDefaultAddress(user.id, "shipping"))?.id).toBe(first.id);
  });

  it("promotes the oldest remaining address when a default is deleted", async () => {
    const user = await createCustomer("address-delete");
    const first = await createAddress(user.id, { ...address, label: "Home" });
    const second = await createAddress(user.id, {
      ...address,
      label: "Office",
      isDefaultShipping: true,
    });

    expect(await deleteAddress(user.id, second.id)).toBe(true);

    const remaining = await listAddresses(user.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(first.id);
    expect(remaining[0]?.isDefaultShipping).toBe(true);
    expect(remaining[0]?.isDefaultBilling).toBe(true);
  });

  it("does not let one customer read or change another customer's address", async () => {
    const owner = await createCustomer("address-owner");
    const stranger = await createCustomer("address-stranger");
    const saved = await createAddress(owner.id, address);

    expect(await getAddress(stranger.id, saved.id)).toBeNull();
    expect(await updateAddress(stranger.id, saved.id, address)).toBeNull();
    expect(await deleteAddress(stranger.id, saved.id)).toBe(false);
    expect(await getAddress(owner.id, saved.id)).not.toBeNull();
  });
});

describe("claiming a guest order", () => {
  it("links the order once and keeps it idempotent", async () => {
    const customer = await createCustomer("claim");
    const token = "claim-token-1";
    const order = await createOrder(null, token);

    const first = await claimOrder({ number: order.number, token, userId: customer.id });
    expect(first.ok).toBe(true);

    const [claimed] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, order.id))
      .limit(1);
    expect(claimed?.userId).toBe(customer.id);

    const again = await claimOrder({ number: order.number, token, userId: customer.id });
    expect(again.ok).toBe(true);

    const view = await getOrderForCustomer(order.number, customer.id);
    expect(view?.billingAddress?.area).toBe("Jumeirah 1");

    const history = await listOrdersForCustomer(customer.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.number).toBe(order.number);

    const audits = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, "order.claim"), eq(auditLog.entityId, order.id)));
    expect(audits).toHaveLength(1);
  });

  it("refuses a wrong token and an order already owned by someone else", async () => {
    const owner = await createCustomer("claim-owner");
    const other = await createCustomer("claim-other");
    const token = "claim-token-2";
    const order = await createOrder(null, token);

    const wrong = await claimOrder({ number: order.number, token: "wrong", userId: owner.id });
    expect(wrong.ok).toBe(false);

    const first = await claimOrder({ number: order.number, token, userId: owner.id });
    expect(first.ok).toBe(true);

    const second = await claimOrder({ number: order.number, token, userId: other.id });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toMatch(/another account/i);
  });

  it("refuses an expired lookup link", async () => {
    const customer = await createCustomer("claim-expired");
    const token = "claim-token-3";
    const order = await createOrder(null, token);

    await db
      .update(orders)
      .set({ lookupExpiresAt: new Date(Date.now() - 1_000) })
      .where(eq(orders.id, order.id));

    const result = await claimOrder({ number: order.number, token, userId: customer.id });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/expired/i);
  });
});

describe("account deletion", () => {
  it("anonymises the profile but keeps the order as a tombstone record", async () => {
    const customer = await createCustomer("delete");
    const saved = await createAddress(customer.id, address);
    const order = await createOrder(customer.id, "delete-token", customer.email);

    expect(await anonymizeCustomer(customer.id, customer.id)).toBe(true);

    const [anonymised] = await db
      .select()
      .from(users)
      .where(eq(users.id, customer.id))
      .limit(1);

    expect(anonymised?.deletedAt).not.toBeNull();
    expect(anonymised?.name).toBe("Deleted customer");
    expect(anonymised?.email).toMatch(/^deleted\+/);
    expect(anonymised?.phone).toBeNull();
    expect(await getAddress(customer.id, saved.id)).toBeNull();
    expect(await listAddresses(customer.id)).toHaveLength(0);

    const stillThere = await getOrderForCustomer(order.number, customer.id);
    expect(stillThere?.number).toBe(order.number);

    const adminView = await getCustomerForAdmin(customer.id);
    expect(adminView?.user.deletedAt).not.toBeNull();

    expect(await anonymizeCustomer(customer.id, customer.id)).toBe(false);
  });
});
