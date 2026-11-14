"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addressFromFormData, type Address } from "@/lib/address";
import { getAuthSession } from "@/server/auth/guard";
import { checkRateLimit } from "@/server/security/rate-limit";
import { clientIp } from "@/server/security/request";
import { saveCheckoutAddress } from "@/server/services/addresses";
import { placeOrder } from "@/server/services/orders";

export type CheckoutState = { error: string } | null;

export async function checkoutAction(
  _previous: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const limit = await checkRateLimit(`checkout:${await clientIp()}`, 10, 60);
  if (!limit.ok) {
    return { error: "Too many checkout attempts. Try again in a moment." };
  }

  const expectedTotalMinor = Number(formData.get("expectedTotalMinor"));
  const session = await getAuthSession();

  const shipping = addressFromFormData(formData);
  if (!shipping.success) {
    return { error: shipping.error.issues[0]?.message ?? "Check the delivery address." };
  }

  const billingSameAsDelivery = formData.get("billingSameAsDelivery") === "on";
  let billingAddress: Address = shipping.data;

  if (!billingSameAsDelivery) {
    const billing = addressFromFormData(formData, "billing");
    if (!billing.success) {
      return { error: billing.error.issues[0]?.message ?? "Check the billing address." };
    }
    billingAddress = billing.data;
  }

  const result = await placeOrder({
    email: String(formData.get("email") ?? ""),
    address: shipping.data,
    billingAddress,
    expectedTotalMinor: Number.isFinite(expectedTotalMinor) ? expectedTotalMinor : -1,
    userId: session?.user.id ?? null,
  });

  if (!result.ok) return { error: result.error };

  if (session) {
    const saves: Promise<unknown>[] = [];
    if (formData.get("saveShippingAddress") === "on") {
      saves.push(saveCheckoutAddress(session.user.id, shipping.data));
    }
    if (!billingSameAsDelivery && formData.get("saveBillingAddress") === "on") {
      saves.push(saveCheckoutAddress(session.user.id, billingAddress));
    }
    const settled = await Promise.allSettled(saves);
    for (const outcome of settled) {
      if (outcome.status === "rejected") {
        console.error("saving a checkout address failed", outcome.reason);
      }
    }
  }

  // The order consumed the cart. The header lives in the layout, so the layout
  // cache has to be dropped or the badge keeps the pre-checkout count.
  revalidatePath("/", "layout");
  revalidatePath("/account/orders");
  revalidatePath("/account");
  revalidatePath("/checkout");

  redirect(
    `/orders/${encodeURIComponent(result.data.number)}?t=${encodeURIComponent(result.data.lookupToken)}`,
  );
}
