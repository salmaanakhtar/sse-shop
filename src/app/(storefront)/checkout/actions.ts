"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Address } from "@/lib/address";
import { placeOrder } from "@/server/services/orders";

export type CheckoutState = { error: string } | null;

export async function checkoutAction(
  _previous: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const expectedTotalMinor = Number(formData.get("expectedTotalMinor"));

  const result = await placeOrder({
    email: String(formData.get("email") ?? ""),
    address: {
      fullName: String(formData.get("fullName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      emirate: String(formData.get("emirate") ?? "") as Address["emirate"],
      street: String(formData.get("street") ?? ""),
      building: String(formData.get("building") ?? ""),
      poBox: String(formData.get("poBox") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    },
    expectedTotalMinor: Number.isFinite(expectedTotalMinor) ? expectedTotalMinor : -1,
  });

  if (!result.ok) return { error: result.error };

  // The order consumed the cart. The header lives in the layout, so the layout
  // cache has to be dropped or the badge keeps the pre-checkout count.
  revalidatePath("/", "layout");

  redirect(
    `/orders/${encodeURIComponent(result.data.number)}?t=${encodeURIComponent(result.data.lookupToken)}`,
  );
}


