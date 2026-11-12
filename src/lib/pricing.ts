import { vatComponent } from "./money";
import { shippingFor, type ShippingSettings } from "./shipping";

export type PricedLine = {
  unitPriceMinor: number;
  quantity: number;
};

export type CartTotals = {
  /** Sum of line totals, VAT-inclusive. */
  subtotalMinor: number;
  shippingMinor: number;
  discountMinor: number;
  /** What the shopper pays. VAT is already inside this number. */
  totalMinor: number;
  /** The VAT component of the total, not an addend. */
  taxMinor: number;
};

export type PriceCartInput = {
  lines: readonly PricedLine[];
  shipping: ShippingSettings;
  /** Basis points: 500 = 5%. */
  taxRateBp: number;
  discountMinor?: number;
};

/**
 * The single place cart totals are computed. The cart page and the checkout
 * action both call this, so the number the shopper sees is the number that is
 * charged or the checkout fails.
 */
export function priceCart(input: PriceCartInput): CartTotals {
  let subtotalMinor = 0;
  for (const line of input.lines) {
    if (!Number.isInteger(line.unitPriceMinor) || line.unitPriceMinor < 0) {
      throw new TypeError(`unit price must be a non-negative integer, received ${line.unitPriceMinor}`);
    }
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new TypeError(`quantity must be a positive integer, received ${line.quantity}`);
    }
    subtotalMinor += line.unitPriceMinor * line.quantity;
  }

  const shippingMinor = shippingFor(subtotalMinor, input.shipping);
  const gross = subtotalMinor + shippingMinor;

  const requestedDiscount = input.discountMinor ?? 0;
  if (!Number.isInteger(requestedDiscount) || requestedDiscount < 0) {
    throw new TypeError(`discount must be a non-negative integer, received ${requestedDiscount}`);
  }
  const discountMinor = Math.min(requestedDiscount, gross);

  const totalMinor = gross - discountMinor;

  return {
    subtotalMinor,
    shippingMinor,
    discountMinor,
    totalMinor,
    taxMinor: vatComponent(totalMinor, input.taxRateBp),
  };
}
