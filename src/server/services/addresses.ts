import { and, asc, desc, eq, ne } from "drizzle-orm";
import type { Address } from "@/lib/address";
import { db } from "../db/client";
import { customerAddresses } from "../db/schema";

export type SavedAddress = typeof customerAddresses.$inferSelect;

export type AddressInput = Address & {
  label?: string;
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
};

function addressValues(input: AddressInput) {
  return {
    label: input.label?.trim() ?? "",
    fullName: input.fullName,
    phone: input.phone,
    emirate: input.emirate,
    street: input.street,
    building: input.building,
    area: input.area ?? "",
    poBox: input.poBox ?? "",
    notes: input.notes ?? "",
  };
}

function sameAddress(a: SavedAddress, b: AddressInput): boolean {
  return (
    a.fullName === b.fullName &&
    a.phone === b.phone &&
    a.emirate === b.emirate &&
    a.street === b.street &&
    a.building === b.building &&
    a.area === (b.area ?? "") &&
    a.poBox === (b.poBox ?? "") &&
    a.notes === (b.notes ?? "")
  );
}

export async function listAddresses(userId: string): Promise<SavedAddress[]> {
  return db
    .select()
    .from(customerAddresses)
    .where(eq(customerAddresses.userId, userId))
    .orderBy(
      desc(customerAddresses.isDefaultShipping),
      desc(customerAddresses.isDefaultBilling),
      asc(customerAddresses.createdAt),
    );
}

export async function getAddress(
  userId: string,
  addressId: string,
): Promise<SavedAddress | null> {
  const [address] = await db
    .select()
    .from(customerAddresses)
    .where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.userId, userId)))
    .limit(1);

  return address ?? null;
}

export async function getDefaultAddress(
  userId: string,
  kind: "shipping" | "billing",
): Promise<SavedAddress | null> {
  const column =
    kind === "shipping" ? customerAddresses.isDefaultShipping : customerAddresses.isDefaultBilling;

  const [address] = await db
    .select()
    .from(customerAddresses)
    .where(and(eq(customerAddresses.userId, userId), eq(column, true)))
    .limit(1);

  return address ?? null;
}

export async function createAddress(
  userId: string,
  input: AddressInput,
): Promise<SavedAddress> {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: customerAddresses.id })
      .from(customerAddresses)
      .where(eq(customerAddresses.userId, userId));

    // The first address is the default for both purposes. Later addresses only
    // take a default when the customer ticks the box.
    const first = existing.length === 0;
    const makeShippingDefault = first || input.isDefaultShipping === true;
    const makeBillingDefault = first || input.isDefaultBilling === true;

    if (makeShippingDefault) {
      await tx
        .update(customerAddresses)
        .set({ isDefaultShipping: false, updatedAt: new Date() })
        .where(eq(customerAddresses.userId, userId));
    }
    if (makeBillingDefault) {
      await tx
        .update(customerAddresses)
        .set({ isDefaultBilling: false, updatedAt: new Date() })
        .where(eq(customerAddresses.userId, userId));
    }

    const [created] = await tx
      .insert(customerAddresses)
      .values({
        userId,
        ...addressValues(input),
        isDefaultShipping: makeShippingDefault,
        isDefaultBilling: makeBillingDefault,
      })
      .returning();

    if (!created) throw new Error("Could not save the address.");

    return created;
  });
}

export async function updateAddress(
  userId: string,
  addressId: string,
  input: AddressInput,
): Promise<SavedAddress | null> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(customerAddresses)
      .where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.userId, userId)))
      .limit(1);

    if (!current) return null;

    const makeShippingDefault = input.isDefaultShipping ?? current.isDefaultShipping;
    const makeBillingDefault = input.isDefaultBilling ?? current.isDefaultBilling;

    if (makeShippingDefault && !current.isDefaultShipping) {
      await tx
        .update(customerAddresses)
        .set({ isDefaultShipping: false, updatedAt: new Date() })
        .where(eq(customerAddresses.userId, userId));
    }
    if (makeBillingDefault && !current.isDefaultBilling) {
      await tx
        .update(customerAddresses)
        .set({ isDefaultBilling: false, updatedAt: new Date() })
        .where(eq(customerAddresses.userId, userId));
    }

    const [updated] = await tx
      .update(customerAddresses)
      .set({
        ...addressValues(input),
        isDefaultShipping: makeShippingDefault,
        isDefaultBilling: makeBillingDefault,
        updatedAt: new Date(),
      })
      .where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.userId, userId)))
      .returning();

    return updated ?? null;
  });
}

/**
 * Deletes one saved address. If it was a default, the oldest remaining address
 * becomes the default so checkout always has a sensible fallback.
 */
export async function deleteAddress(userId: string, addressId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(customerAddresses)
      .where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.userId, userId)))
      .limit(1);

    if (!current) return false;

    await tx
      .delete(customerAddresses)
      .where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.userId, userId)));

    if (current.isDefaultShipping || current.isDefaultBilling) {
      const [next] = await tx
        .select()
        .from(customerAddresses)
        .where(
          and(eq(customerAddresses.userId, userId), ne(customerAddresses.id, addressId)),
        )
        .orderBy(asc(customerAddresses.createdAt))
        .limit(1);

      if (next) {
        await tx
          .update(customerAddresses)
          .set({
            isDefaultShipping: current.isDefaultShipping || next.isDefaultShipping,
            isDefaultBilling: current.isDefaultBilling || next.isDefaultBilling,
            updatedAt: new Date(),
          })
          .where(eq(customerAddresses.id, next.id));
      }
    }

    return true;
  });
}

/**
 * Saves an address used at checkout unless an identical one already exists.
 * Existing rows are left untouched, so checkout never silently rewrites a
 * customer's labels or defaults.
 */
export async function saveCheckoutAddress(
  userId: string,
  input: Address,
): Promise<SavedAddress> {
  const existing = await listAddresses(userId);
  const match = existing.find((address) => sameAddress(address, input));
  if (match) return match;

  return createAddress(userId, input);
}
