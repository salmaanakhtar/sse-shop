import { describe, expect, it } from "vitest";
import { amountUntilFreeShipping, DEFAULT_SHIPPING, shippingFor } from "@/lib/shipping";

const settings = { flatRateMinor: 2_000, freeThresholdMinor: 20_000 };

describe("shippingFor", () => {
  it("charges nothing for an empty cart", () => {
    expect(shippingFor(0, settings)).toBe(0);
  });

  it("charges the flat rate below the threshold", () => {
    expect(shippingFor(1, settings)).toBe(2_000);
    expect(shippingFor(19_999, settings)).toBe(2_000);
  });

  it("waives shipping at and above the threshold", () => {
    expect(shippingFor(20_000, settings)).toBe(0);
    expect(shippingFor(250_000, settings)).toBe(0);
  });

  it("treats a zero threshold as a misconfiguration, not free shipping", () => {
    // A threshold of 0 would otherwise make every cart free by accident.
    expect(shippingFor(19_999, { flatRateMinor: 2_000, freeThresholdMinor: 0 })).toBe(2_000);
    expect(shippingFor(20_000, { flatRateMinor: 2_000, freeThresholdMinor: 0 })).toBe(2_000);
  });

  it("rejects a negative subtotal", () => {
    expect(() => shippingFor(-1, settings)).toThrow(TypeError);
  });

  it("ships the documented development defaults", () => {
    expect(DEFAULT_SHIPPING.freeThresholdMinor).toBe(20_000);
    expect(DEFAULT_SHIPPING.flatRateMinor).toBe(2_000);
  });
});

describe("amountUntilFreeShipping", () => {
  it("counts down to the threshold", () => {
    expect(amountUntilFreeShipping(0, settings)).toBe(20_000);
    expect(amountUntilFreeShipping(15_000, settings)).toBe(5_000);
    expect(amountUntilFreeShipping(20_000, settings)).toBe(0);
    expect(amountUntilFreeShipping(30_000, settings)).toBe(0);
  });

  it("reports zero when shipping is always free", () => {
    expect(amountUntilFreeShipping(1_000, { flatRateMinor: 0, freeThresholdMinor: 0 })).toBe(0);
  });
});
