"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { localePath, type Locale } from "@/lib/i18n";
import { getAuthSession } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import {
  LOCALE_COOKIE,
  NUMERALS_COOKIE,
  THEME_COOKIE,
} from "@/server/services/preferences";

const themeSchema = z.object({
  theme: z.enum(["system", "light", "dark"]),
});

const localeSchema = z.object({
  locale: z.enum(["en", "ar"]),
  next: z.string().trim().startsWith("/").max(1_000),
});

const numeralsSchema = z.object({
  numerals: z.enum(["latin", "arabic"]),
  next: z.string().trim().startsWith("/").max(1_000),
});

function cookieOptions() {
  return {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: true,
    secure: (process.env.NEXT_PUBLIC_STORE_URL ?? "").startsWith("https://"),
    maxAge: 60 * 60 * 24 * 365,
  };
}

function safeNext(value: string): string {
  return value.startsWith("//") ? "/" : value;
}

export async function setLocaleAction(formData: FormData): Promise<void> {
  const parsed = localeSchema.safeParse({
    locale: formData.get("locale"),
    next: formData.get("next"),
  });
  if (!parsed.success) redirect("/");

  const next = safeNext(parsed.data.next);
  const store = await cookies();
  store.set(LOCALE_COOKIE, parsed.data.locale, cookieOptions());

  const session = await getAuthSession();
  if (session) {
    await db
      .update(users)
      .set({ locale: parsed.data.locale, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));
  }

  revalidatePath("/", "layout");
  redirect(localePath(parsed.data.locale as Locale, next));
}

export async function setNumeralsAction(formData: FormData): Promise<void> {
  const parsed = numeralsSchema.safeParse({
    numerals: formData.get("numerals"),
    next: formData.get("next"),
  });
  if (!parsed.success) redirect("/");

  const next = safeNext(parsed.data.next);
  const store = await cookies();
  store.set(NUMERALS_COOKIE, parsed.data.numerals, cookieOptions());

  const session = await getAuthSession();
  if (session) {
    await db
      .update(users)
      .set({ numeralStyle: parsed.data.numerals, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function setThemePreferenceAction(theme: string): Promise<void> {
  const parsed = themeSchema.safeParse({ theme });
  if (!parsed.success) return;

  const store = await cookies();
  store.set(THEME_COOKIE, parsed.data.theme, cookieOptions());

  const session = await getAuthSession();
  if (session) {
    await db
      .update(users)
      .set({ themePreference: parsed.data.theme, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));
  }

  revalidatePath("/", "layout");
}
