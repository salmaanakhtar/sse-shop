import { describe, expect, it } from "vitest";
import { badgeToneClass, isBadgeTone } from "@/lib/badges";

describe("isBadgeTone", () => {
  it("accepts the four supported tones and rejects anything else", () => {
    for (const tone of ["brand", "neutral", "success", "warning"]) {
      expect(isBadgeTone(tone)).toBe(true);
    }
    expect(isBadgeTone("destructive")).toBe(false);
    expect(isBadgeTone("")).toBe(false);
  });
});

describe("badgeToneClass", () => {
  it("maps a known tone to its class and falls back to brand", () => {
    expect(badgeToneClass("warning")).toContain("amber");
    expect(badgeToneClass("unknown")).toBe(badgeToneClass("brand"));
  });
});
