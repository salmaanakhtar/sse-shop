import { describe, expect, it } from "vitest";
import { isThemePreference, resolveThemePreference } from "@/lib/theme";

describe("theme preferences", () => {
  it("accepts only system, light, and dark", () => {
    expect(isThemePreference("system")).toBe(true);
    expect(isThemePreference("light")).toBe(true);
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("sepia")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });

  it("gives an explicit cookie choice priority over the account", () => {
    expect(resolveThemePreference("light", "dark")).toBe("light");
    expect(resolveThemePreference("dark", "light")).toBe("dark");
  });

  it("falls back to the account when the cookie is system or absent", () => {
    expect(resolveThemePreference("system", "dark")).toBe("dark");
    expect(resolveThemePreference(null, "light")).toBe("light");
  });

  it("returns system when neither source has an override", () => {
    expect(resolveThemePreference("system", "system")).toBe("system");
    expect(resolveThemePreference(null, null)).toBe("system");
    expect(resolveThemePreference("sepia", "unknown")).toBe("system");
  });
});
