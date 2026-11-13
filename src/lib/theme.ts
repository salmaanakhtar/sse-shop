export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return (THEME_PREFERENCES as readonly string[]).includes(value ?? "");
}

/**
 * The browser cookie is an explicit per-device choice. "system" falls through
 * to the signed-in account preference, then to the operating system.
 */
export function resolveThemePreference(
  cookieValue: string | null | undefined,
  accountValue: string | null | undefined,
): ThemePreference {
  if (isThemePreference(cookieValue) && cookieValue !== "system") return cookieValue;
  if (isThemePreference(accountValue) && accountValue !== "system") return accountValue;
  return "system";
}
