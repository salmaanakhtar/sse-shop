/**
 * Shipping is one flat rate, waived once the item subtotal reaches the
 * free-shipping threshold. Both values come from `settings`; the defaults here
 * are placeholders for development and are overridden in the database.
 */

export type ShippingSettings = {
  flatRateMinor: number;
  freeThresholdMinor: number;
};

export const DEFAULT_SHIPPING: ShippingSettings = {
  flatRateMinor: 2000,
  freeThresholdMinor: 20_000,
};

/**
 * The shipping charge for a cart. The threshold is compared against the item
 * subtotal before discounts, so a discount code cannot push an order back into
 * paying for shipping.
 */
export function shippingFor(subtotalMinor: number, settings: ShippingSettings): number {
  if (!Number.isInteger(subtotalMinor) || subtotalMinor < 0) {
    throw new TypeError(`subtotal must be a non-negative integer, received ${subtotalMinor}`);
  }
  if (subtotalMinor === 0) return 0;

  const threshold = settings.freeThresholdMinor;
  if (threshold > 0 && subtotalMinor >= threshold) return 0;

  return Math.max(0, settings.flatRateMinor);
}

/** How much more the shopper needs to spend to qualify for free shipping. */
export function amountUntilFreeShipping(
  subtotalMinor: number,
  settings: ShippingSettings,
): number {
  if (settings.freeThresholdMinor <= 0) return 0;
  return Math.max(0, settings.freeThresholdMinor - subtotalMinor);
}

/* ───────────────────────── zones and weight bands ───────────────────────── */

export type ShippingBand = {
  minWeightGrams: number;
  /** Null means "and above"; the last band is open-ended. */
  maxWeightGrams: number | null;
  rateMinor: number;
};

export type ShippingZoneRule = {
  freeThresholdMinor: number;
  bands: readonly ShippingBand[];
};

export function bandForWeight(
  bands: readonly ShippingBand[],
  weightGrams: number,
): ShippingBand | null {
  const sorted = [...bands].sort((a, b) => a.minWeightGrams - b.minWeightGrams);
  return (
    sorted.find(
      (band) =>
        weightGrams >= band.minWeightGrams &&
        (band.maxWeightGrams === null || weightGrams <= band.maxWeightGrams),
    ) ?? null
  );
}

/**
 * The shipping charge for one emirate zone. Returns null when the zone has no
 * band covering the weight, so the caller can fall back to the store flat rate
 * instead of silently charging nothing.
 */
export function zoneShippingFor(
  subtotalMinor: number,
  weightGrams: number,
  zone: ShippingZoneRule,
): number | null {
  if (!Number.isInteger(subtotalMinor) || subtotalMinor < 0) {
    throw new TypeError(`subtotal must be a non-negative integer, received ${subtotalMinor}`);
  }
  if (!Number.isInteger(weightGrams) || weightGrams < 0) {
    throw new TypeError(`weight must be a non-negative integer, received ${weightGrams}`);
  }
  if (subtotalMinor === 0) return 0;

  if (zone.freeThresholdMinor > 0 && subtotalMinor >= zone.freeThresholdMinor) return 0;

  const band = bandForWeight(zone.bands, weightGrams);
  return band ? Math.max(0, band.rateMinor) : null;
}
