"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/server/auth/guard";
import { checkRateLimit } from "@/server/security/rate-limit";
import { clientIp } from "@/server/security/request";
import {
  requestOrderCancellation,
  requestOrderReturn,
} from "@/server/services/orders";

function orderUrl(
  number: string,
  token: string,
  params: Record<string, string>,
  signedIn: boolean,
): string {
  const base = signedIn
    ? `/account/orders/${encodeURIComponent(number)}`
    : `/orders/${encodeURIComponent(number)}`;
  const search = new URLSearchParams();
  if (!signedIn) search.set("t", token);
  for (const [key, value] of Object.entries(params)) search.set(key, value);
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

export async function requestCancellationAction(formData: FormData): Promise<void> {
  const number = String(formData.get("number") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!number) redirect("/account/orders");

  const session = await getAuthSession();
  const signedIn = Boolean(session);
  const limit = await checkRateLimit(
    `cancel:${session?.user.id ?? (await clientIp())}`,
    5,
    3_600,
  );
  if (!limit.ok) {
    redirect(
      orderUrl(number, token, { cancelError: "Too many requests. Try again later." }, signedIn),
    );
  }

  const result = await requestOrderCancellation({
    number,
    token: token || null,
    userId: session?.user.id ?? null,
    reason,
  });

  if (!result.ok) {
    redirect(orderUrl(number, token, { cancelError: result.error }, signedIn));
  }

  revalidatePath(`/orders/${number}`);
  revalidatePath(`/account/orders/${number}`);
  revalidatePath("/account/orders");
  redirect(orderUrl(number, token, { cancelled: "requested" }, signedIn));
}

export async function requestReturnAction(formData: FormData): Promise<void> {
  const number = String(formData.get("number") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!number) redirect("/account/orders");

  const session = await getAuthSession();
  const signedIn = Boolean(session);
  const limit = await checkRateLimit(
    `return:${session?.user.id ?? (await clientIp())}`,
    5,
    3_600,
  );
  if (!limit.ok) {
    redirect(
      orderUrl(number, token, { returnError: "Too many requests. Try again later." }, signedIn),
    );
  }

  const result = await requestOrderReturn({
    number,
    token: token || null,
    userId: session?.user.id ?? null,
    reason,
  });

  if (!result.ok) {
    redirect(orderUrl(number, token, { returnError: result.error }, signedIn));
  }

  revalidatePath(`/orders/${number}`);
  revalidatePath(`/account/orders/${number}`);
  revalidatePath("/account/orders");
  redirect(orderUrl(number, token, { return: "requested" }, signedIn));
}
