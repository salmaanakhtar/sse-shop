import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { resolveThemePreference, type ThemePreference } from "@/lib/theme";
import { getAuthSession } from "../auth/guard";
import { db } from "../db/client";
import { users } from "../db/schema";

export const THEME_COOKIE = "storefront_theme";

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
