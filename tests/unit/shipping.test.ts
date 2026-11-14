import { describe, expect, it } from "vitest";
import {
  amountUntilFreeShipping,
  bandForWeight,
  DEFAULT_SHIPPING,
  shippingFor,
  zoneShippingFor,
  type ShippingBand,
} from "@/lib/shipping";

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

const bands: ShippingBand[] = [
  { minWeightGrams: 0, maxWeightGrams: 2_000, rateMinor: 2_000 },
  { minWeightGrams: 2_001, maxWeightGrams: 5_000, rateMinor: 3_000 },
  { minWeightGrams: 5_001, maxWeightGrams: null, rateMinor: 4_000 },
];

describe("bandForWeight", () => {
  it("matches inclusive band boundaries", () => {
    expect(bandForWeight(bands, 0)?.rateMinor).toBe(2_000);
    expect(bandForWeight(bands, 2_000)?.rateMinor).toBe(2_000);
    expect(bandForWeight(bands, 2_001)?.rateMinor).toBe(3_000);
    expect(bandForWeight(bands, 5_000)?.rateMinor).toBe(3_000);
  });

  it("treats a null maximum as the open-ended top band", () => {
    expect(bandForWeight(bands, 5_001)?.rateMinor).toBe(4_000);
    expect(bandForWeight(bands, 50_000)?.rateMinor).toBe(4_000);
  });

  it("returns null when a gap leaves the weight uncovered", () => {
    expect(bandForWeight([{ minWeightGrams: 0, maxWeightGrams: 1_000, rateMinor: 2_000 }], 1_001)).toBeNull();
  });
});

describe("zoneShippingFor", () => {
  const zone = { freeThresholdMinor: 20_000, bands };

  it("charges the band for the cart weight", () => {
    expect(zoneShippingFor(5_000, 1_500, zone)).toBe(2_000);
    expect(zoneShippingFor(5_000, 3_000, zone)).toBe(3_000);
    expect(zoneShippingFor(5_000, 8_000, zone)).toBe(4_000);
  });

  it("waives the charge at the zone threshold", () => {
    expect(zoneShippingFor(19_999, 3_000, zone)).toBe(3_000);
    expect(zoneShippingFor(20_000, 3_000, zone)).toBe(0);
  });

  it("returns null instead of guessing when no band matches", () => {
    const gapZone = {
      freeThresholdMinor: 20_000,
      bands: [{ minWeightGrams: 0, maxWeightGrams: 1_000, rateMinor: 2_000 }],
    };
    expect(zoneShippingFor(5_000, 2_000, gapZone)).toBeNull();
  });

  it("rejects a negative weight", () => {
    expect(() => zoneShippingFor(5_000, -1, zone)).toThrow(TypeError);
  });
});
