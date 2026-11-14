import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import {
  isLocale,
  isNumeralStyle,
  type Locale,
  type NumeralStyle,
} from "@/lib/i18n";
import { resolveThemePreference, type ThemePreference } from "@/lib/theme";
import { getAuthSession } from "../auth/guard";
import { db } from "../db/client";
import { users } from "../db/schema";

export const THEME_COOKIE = "storefront_theme";
export const LOCALE_COOKIE = "store_locale";
export const NUMERALS_COOKIE = "store_numerals";

export const getLocalePreference = cache(async (): Promise<Locale> => {
  const store = await cookies();
  const cookieValue = store.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieValue)) return cookieValue;

  const session = await getAuthSession();
  if (session) {
    const [row] = await db
      .select({ locale: users.locale })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    if (isLocale(row?.locale)) return row.locale;
  }

  return "en";
});

/** The URL prefix is the source of truth; the cookie is only a fallback. */
export const getLocale = cache(async (): Promise<Locale> => {
  const store = await headers();
  const header = store.get("x-store-locale");
  if (isLocale(header)) return header;
  return getLocalePreference();
});

export const getStorePath = cache(async (): Promise<string> => {
  const store = await headers();
  return store.get("x-store-pathname") ?? "/";
});

export const getNumeralPreference = cache(async (): Promise<NumeralStyle> => {
  const store = await cookies();
  const cookieValue = store.get(NUMERALS_COOKIE)?.value;
  if (isNumeralStyle(cookieValue)) return cookieValue;

  const session = await getAuthSession();
  if (session) {
    const [row] = await db
      .select({ numeralStyle: users.numeralStyle })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    if (isNumeralStyle(row?.numeralStyle)) return row.numeralStyle;
  }

  return "latin";
});

/**
 * Read once per request. A browser cookie wins when it has an explicit
 * light/dark choice; otherwise the signed-in account preference applies, then
 * the operating system.
 */
export const getThemePreference = cache(async (): Promise<ThemePreference> => {
  const store = await cookies();
  const cookieValue = store.get(THEME_COOKIE)?.value ?? null;
  const session = await getAuthSession();

  let accountValue: string | null = null;
  if (session) {
    const [row] = await db
      .select({ themePreference: users.themePreference })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    accountValue = row?.themePreference ?? null;
  }

  return resolveThemePreference(cookieValue, accountValue);
});
