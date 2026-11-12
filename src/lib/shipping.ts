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
