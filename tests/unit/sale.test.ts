import { describe, expect, it } from "vitest";
import { activeSalePrice, discountPercent, effectivePriceMinor } from "@/lib/sale";

const now = new Date("2026-06-01T12:00:00.000Z");

describe("activeSalePrice", () => {
  it("returns a sale with no window", () => {
    expect(
      activeSalePrice(12_000, {
        salePriceMinor: 9_900,
        saleStartsAt: null,
        saleEndsAt: null,
      }, now),
    ).toBe(9_900);
  });

  it("respects the start and end instants", () => {
    expect(
      activeSalePrice(12_000, {
        salePriceMinor: 9_900,
        saleStartsAt: new Date("2026-06-01T13:00:00.000Z"),
        saleEndsAt: null,
      }, now),
    ).toBeNull();

    expect(
      activeSalePrice(12_000, {
        salePriceMinor: 9_900,
        saleStartsAt: null,
        saleEndsAt: new Date("2026-06-01T11:00:00.000Z"),
      }, now),
    ).toBeNull();

    expect(
      activeSalePrice(12_000, {
        salePriceMinor: 9_900,
        saleStartsAt: new Date("2026-06-01T11:00:00.000Z"),
        saleEndsAt: new Date("2026-06-01T13:00:00.000Z"),
      }, now),
    ).toBe(9_900);
  });

  it("rejects a sale that is not below the regular price", () => {
    expect(
      activeSalePrice(12_000, {
        salePriceMinor: 12_000,
        saleStartsAt: null,
        saleEndsAt: null,
      }, now),
    ).toBeNull();
    expect(
      activeSalePrice(12_000, {
        salePriceMinor: -1,
        saleStartsAt: null,
        saleEndsAt: null,
      }, now),
    ).toBeNull();
  });

  it("allows a free sale", () => {
    expect(
      effectivePriceMinor(12_000, {
        salePriceMinor: 0,
        saleStartsAt: null,
        saleEndsAt: null,
      }, now),
    ).toBe(0);
  });

  it("falls back to the regular price when no sale is active", () => {
    expect(
      effectivePriceMinor(12_000, {
        salePriceMinor: null,
        saleStartsAt: null,
        saleEndsAt: null,
      }, now),
    ).toBe(12_000);
  });
});

describe("discountPercent", () => {
  it("rounds to a whole percentage", () => {
    expect(discountPercent(14_900, 9_900)).toBe(34);
    expect(discountPercent(12_000, 9_000)).toBe(25);
    expect(discountPercent(12_000, 12_000)).toBe(0);
  });
});
