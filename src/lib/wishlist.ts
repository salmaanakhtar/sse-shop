/**
 * The alert threshold is the highest price the customer saved the variant at.
 * If the same variant sits in several lists, one qualifying drop still sends
 * one email, so the highest saved price decides whether any list qualifies.
 */
export function priceDropThreshold(addedPricesMinor: readonly number[]): number | null {
  if (addedPricesMinor.length === 0) return null;
  return Math.max(...addedPricesMinor);
}

export function qualifiesForPriceAlert(
  addedPricesMinor: readonly number[],
  effectivePriceMinor: number,
  alreadyAlerted: boolean,
): boolean {
  if (alreadyAlerted) return false;
  const threshold = priceDropThreshold(addedPricesMinor);
  return threshold !== null && effectivePriceMinor < threshold;
}
