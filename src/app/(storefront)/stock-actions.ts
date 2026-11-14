"use server";

import { z } from "zod";
import { fail, type Result } from "@/lib/result";
import { getAuthSession } from "@/server/auth/guard";
import { checkRateLimit } from "@/server/security/rate-limit";
import { clientIp } from "@/server/security/request";
import { subscribeToStockAlert } from "@/server/services/notifications";

const schema = z.object({
  variantId: z.string().trim().min(1),
  email: z.string().trim().email("Enter a valid email address"),
  consent: z.literal(true),
});

export async function notifyWhenBackInStockAction(input: {
  variantId: string;
  email: string;
  consent: boolean;
}): Promise<Result<{ status: "subscribed" | "in_stock" }>> {
  const limit = await checkRateLimit(`stock-alert:${await clientIp()}`, 5, 3_600);
  if (!limit.ok) return fail("Too many requests. Try again later.");

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the email address and consent.");
  }

  const session = await getAuthSession();
  return subscribeToStockAlert({
    variantId: parsed.data.variantId,
    email: session?.user.email ?? parsed.data.email,
    userId: session?.user.id ?? null,
  });
}
