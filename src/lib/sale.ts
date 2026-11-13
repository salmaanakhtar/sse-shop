export type SaleWindow = {
  salePriceMinor: number | null;
  saleStartsAt: Date | string | null;
  saleEndsAt: Date | string | null;
};

function instant(value: Date | string | null): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * The sale price if the window is active and the price is a real discount,
 * otherwise null. An invalid date is treated as an open bound.
 */
export function activeSalePrice(
  regularPriceMinor: number,
  sale: SaleWindow,
  now: Date = new Date(),
): number | null {
  if (sale.salePriceMinor === null) return null;
  if (
    !Number.isInteger(sale.salePriceMinor) ||
    sale.salePriceMinor < 0 ||
    sale.salePriceMinor >= regularPriceMinor
  ) {
    return null;
  }

  const nowMs = now.getTime();
  const startsAt = instant(sale.saleStartsAt);
  if (startsAt !== null && startsAt > nowMs) return null;

  const endsAt = instant(sale.saleEndsAt);
  if (endsAt !== null && endsAt <= nowMs) return null;

  return sale.salePriceMinor;
}

export function effectivePriceMinor(
  regularPriceMinor: number,
  sale: SaleWindow,
  now: Date = new Date(),
): number {
  return activeSalePrice(regularPriceMinor, sale, now) ?? regularPriceMinor;
}

/** Whole-percent discount, e.g. 149.00 -> 99.00 is 34%. */
export function discountPercent(regularPriceMinor: number, salePriceMinor: number): number {
  if (regularPriceMinor <= 0 || salePriceMinor >= regularPriceMinor) return 0;
  return Math.round(((regularPriceMinor - salePriceMinor) / regularPriceMinor) * 100);
}
