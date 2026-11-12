import { describe, expect, it } from "vitest";
import { priceCart } from "@/lib/pricing";

const shipping = { flatRateMinor: 2_000, freeThresholdMinor: 20_000 };
const taxRateBp = 500;

describe("priceCart", () => {
  it("returns zeroes for an empty cart", () => {
    const totals = priceCart({ lines: [], shipping, taxRateBp });
    expect(totals).toEqual({
      subtotalMinor: 0,
      shippingMinor: 0,
      discountMinor: 0,
      totalMinor: 0,
      taxMinor: 0,
    });
  });

  it("adds shipping below the free threshold", () => {
    const totals = priceCart({
      lines: [{ unitPriceMinor: 12_000, quantity: 1 }],
      shipping,
      taxRateBp,
    });

    expect(totals.subtotalMinor).toBe(12_000);
    expect(totals.shippingMinor).toBe(2_000);
    expect(totals.totalMinor).toBe(14_000);
    expect(totals.taxMinor).toBe(667);
  });

  it("waives shipping above the threshold", () => {
    const totals = priceCart({
      lines: [{ unitPriceMinor: 24_000, quantity: 1 }],
      shipping,
      taxRateBp,
    });

    expect(totals.shippingMinor).toBe(0);
    expect(totals.totalMinor).toBe(24_000);
    expect(totals.taxMinor).toBe(1_143);
  });

  it("sums multiple lines and quantities", () => {
    const totals = priceCart({
      lines: [
        { unitPriceMinor: 12_000, quantity: 1 },
        { unitPriceMinor: 5_000, quantity: 2 },
      ],
      shipping,
      taxRateBp,
    });

    expect(totals.subtotalMinor).toBe(22_000);
    expect(totals.shippingMinor).toBe(0);
    expect(totals.taxMinor).toBe(1_048);
  });

  it("applies a discount before extracting VAT", () => {
    const totals = priceCart({
      lines: [{ unitPriceMinor: 24_000, quantity: 1 }],
      shipping,
      taxRateBp,
      discountMinor: 5_000,
    });

    expect(totals.discountMinor).toBe(5_000);
    expect(totals.totalMinor).toBe(19_000);
    expect(totals.taxMinor).toBe(905);
  });

  it("clamps a discount to what is owed rather than going negative", () => {
    const totals = priceCart({
      lines: [{ unitPriceMinor: 24_000, quantity: 1 }],
      shipping,
      taxRateBp,
      discountMinor: 999_999,
    });

    expect(totals.totalMinor).toBe(0);
    expect(totals.discountMinor).toBe(24_000);
    expect(totals.taxMinor).toBe(0);
  });

  it("never adds tax on top of the total", () => {
    const totals = priceCart({
      lines: [{ unitPriceMinor: 7_500, quantity: 3 }],
      shipping,
      taxRateBp,
    });

    expect(totals.totalMinor).toBe(totals.subtotalMinor + totals.shippingMinor - totals.discountMinor);
    expect(totals.taxMinor).toBeLessThan(totals.totalMinor);
    expect(totals.totalMinor + totals.taxMinor).not.toBe(totals.totalMinor);
  });

  it("throws on a quantity of zero or less", () => {
    expect(() =>
      priceCart({ lines: [{ unitPriceMinor: 100, quantity: 0 }], shipping, taxRateBp }),
    ).toThrow(TypeError);
  });

  it("throws on a negative unit price", () => {
    expect(() =>
      priceCart({ lines: [{ unitPriceMinor: -1, quantity: 1 }], shipping, taxRateBp }),
    ).toThrow(TypeError);
  });
});
