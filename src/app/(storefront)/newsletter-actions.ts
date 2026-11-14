"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { localePath } from "@/lib/i18n";
import { checkRateLimit } from "@/server/security/rate-limit";
import { clientIp } from "@/server/security/request";
import {
  sendNewsletterConfirmation,
  subscribeToNewsletter,
} from "@/server/services/marketing";
import { getLocale } from "@/server/services/preferences";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  name: z.string().trim().max(120).optional().default(""),
});

export async function subscribeNewsletterAction(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const back = localePath(locale, "/newsletter");

  if (formData.get("consent") !== "on") {
    redirect(`${back}?error=${encodeURIComponent("Tick the consent box to subscribe.")}`);
  }

  const limit = await checkRateLimit(`newsletter:${await clientIp()}`, 5, 3_600);
  if (!limit.ok) {
    redirect(`${back}?error=${encodeURIComponent("Too many requests. Try again later.")}`);
  }

  const parsed = schema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    redirect(
      `${back}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Check the form.")}`,
    );
  }

  const result = await subscribeToNewsletter({
    email: parsed.data.email,
    name: parsed.data.name,
    source: "newsletter",
  });
  if (!result.ok) {
    redirect(`${back}?error=${encodeURIComponent(result.error)}`);
  }

  if (result.data.status === "already_subscribed") {
    redirect(`${back}?status=already`);
  }

  if (result.data.confirmToken && result.data.unsubscribeToken) {
    await sendNewsletterConfirmation({
      email: parsed.data.email.toLowerCase(),
      confirmToken: result.data.confirmToken,
      unsubscribeToken: result.data.unsubscribeToken,
    }).catch((error) => {
      console.error("newsletter confirmation mail failed", error);
    });
  }

  redirect(`${back}?status=sent`);
}
