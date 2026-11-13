"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUserAction } from "@/server/auth/guard";
import { claimOrder } from "@/server/services/orders";

export type ClaimState = { error?: string } | null;

export async function claimOrderAction(
  _previous: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const session = await requireUserAction();

  const number = String(formData.get("number") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();

  if (!number || !token) {
    return { error: "Enter the order number and the token from your confirmation link." };
  }

  const requestHeaders = await headers();
  const ip =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    requestHeaders.get("x-real-ip");

  const result = await claimOrder({
    number,
    token,
    userId: session.user.id,
    ip,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/account/orders");
  revalidatePath("/", "layout");

  redirect(`/account/orders/${encodeURIComponent(result.data.number)}`);
}
