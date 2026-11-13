import { describe, expect, it } from "vitest";
import { priceDropThreshold, qualifiesForPriceAlert } from "@/lib/wishlist";

describe("priceDropThreshold", () => {
  it("uses the highest saved price across lists", () => {
    expect(priceDropThreshold([12_000])).toBe(12_000);
    expect(priceDropThreshold([9_000, 12_000, 10_500])).toBe(12_000);
    expect(priceDropThreshold([])).toBeNull();
  });
});

describe("qualifiesForPriceAlert", () => {
  it("triggers only when the effective price is below the saved threshold", () => {
    expect(qualifiesForPriceAlert([10_000], 9_999, false)).toBe(true);
    expect(qualifiesForPriceAlert([10_000], 10_000, false)).toBe(false);
    expect(qualifiesForPriceAlert([10_000], 11_000, false)).toBe(false);
  });

  it("uses the highest saved price when the variant is in several lists", () => {
    expect(qualifiesForPriceAlert([8_000, 10_000], 9_500, false)).toBe(true);
    expect(qualifiesForPriceAlert([8_000, 10_000], 10_000, false)).toBe(false);
  });

  it("never repeats after an alert has been sent", () => {
    expect(qualifiesForPriceAlert([10_000], 5_000, true)).toBe(false);
  });

  it("does not trigger for an empty watch list", () => {
    expect(qualifiesForPriceAlert([], 5_000, false)).toBe(false);
  });
});
