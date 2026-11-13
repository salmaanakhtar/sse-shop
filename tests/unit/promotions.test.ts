import { describe, expect, it } from "vitest";
import { isPromotionLive, promotionStatus } from "@/lib/promotions";

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
