import { describe, expect, it } from "vitest";
import {
  isPromotionLive,
  isPromotionTargetType,
  promotionStatus,
  promotionTargetPath,
} from "@/lib/promotions";

const now = new Date("2026-06-01T12:00:00.000Z");

describe("isPromotionLive", () => {
  it("returns true for an active slide with no window", () => {
    expect(isPromotionLive({ active: true, startsAt: null, endsAt: null }, now)).toBe(true);
  });

  it("respects the window", () => {
    expect(
      isPromotionLive(
        {
          active: true,
          startsAt: new Date("2026-06-01T13:00:00.000Z"),
          endsAt: null,
        },
        now,
      ),
    ).toBe(false);
    expect(
      isPromotionLive(
        {
          active: true,
          startsAt: null,
          endsAt: new Date("2026-06-01T11:00:00.000Z"),
        },
        now,
      ),
    ).toBe(false);
  });

  it("returns false for an inactive slide", () => {
    expect(isPromotionLive({ active: false, startsAt: null, endsAt: null }, now)).toBe(false);
  });
});

describe("promotionStatus", () => {
  it("labels live, scheduled, expired, and inactive", () => {
    expect(promotionStatus({ active: true, startsAt: null, endsAt: null }, now)).toBe("live");
    expect(
      promotionStatus(
        { active: true, startsAt: new Date("2026-06-02T00:00:00.000Z"), endsAt: null },
        now,
      ),
    ).toBe("scheduled");
    expect(
      promotionStatus(
        { active: true, startsAt: null, endsAt: new Date("2026-06-01T11:00:00.000Z") },
        now,
      ),
    ).toBe("expired");
    expect(promotionStatus({ active: false, startsAt: null, endsAt: null }, now)).toBe("inactive");
  });
});

describe("promotion targets", () => {
  it("accepts only category, collection, and product", () => {
    expect(isPromotionTargetType("category")).toBe(true);
    expect(isPromotionTargetType("collection")).toBe(true);
    expect(isPromotionTargetType("product")).toBe(true);
    expect(isPromotionTargetType("url")).toBe(false);
    expect(isPromotionTargetType("")).toBe(false);
  });

  it("builds the storefront path for each target type", () => {
    expect(promotionTargetPath("category", "tops")).toBe("/category/tops");
    expect(promotionTargetPath("collection", "featured")).toBe("/collections/featured");
    expect(promotionTargetPath("product", "essential-tee")).toBe("/products/essential-tee");
  });
});
