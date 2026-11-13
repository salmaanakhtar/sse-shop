"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addressFromFormData } from "@/lib/address";
import { requireUserAction } from "@/server/auth/guard";
import { createAddress, deleteAddress, updateAddress } from "@/server/services/addresses";

function extras(formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  return {
    label: label.slice(0, 40),
    isDefaultShipping: formData.get("isDefaultShipping") === "on",
    isDefaultBilling: formData.get("isDefaultBilling") === "on",
  };
}

function back(path: string, error?: string): never {
  redirect(`${path}${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

export async function createAddressAction(formData: FormData): Promise<void> {
  const session = await requireUserAction();
  const parsed = addressFromFormData(formData);

  if (!parsed.success) {
    back(
      "/account/addresses/new",
      parsed.error.issues[0]?.message ?? "Check the address details.",
    );
  }

  await createAddress(session.user.id, { ...parsed.data, ...extras(formData) });

  revalidatePath("/account");
  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  redirect("/account/addresses");
}

export async function updateAddressAction(formData: FormData): Promise<void> {
  const session = await requireUserAction();
  const id = String(formData.get("id") ?? "").trim();
  const editPath = `/account/addresses/${encodeURIComponent(id)}/edit`;

  if (!id) back("/account/addresses", "That address could not be found.");

  const parsed = addressFromFormData(formData);
  if (!parsed.success) {
    back(editPath, parsed.error.issues[0]?.message ?? "Check the address details.");
  }

  const updated = await updateAddress(session.user.id, id, {
    ...parsed.data,
    ...extras(formData),
  });

  if (!updated) back("/account/addresses", "That address could not be found.");

  revalidatePath("/account");
  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  redirect("/account/addresses");
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const session = await requireUserAction();
  const id = String(formData.get("id") ?? "").trim();

  if (!id) back("/account/addresses", "That address could not be found.");

  const deleted = await deleteAddress(session.user.id, id);
  if (!deleted) back("/account/addresses", "That address could not be found.");

  revalidatePath("/account");
  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  redirect("/account/addresses");
}
