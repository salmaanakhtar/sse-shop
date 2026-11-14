import type { Locale, NumeralStyle } from "./i18n";

/**
 * Money is always an integer count of fils. 1 AED = 100 fils.
 * Nothing here divides by 100 except `formatMoney`, which runs at the edge.
 */

export const CURRENCY = "AED" as const;
export const MINOR_PER_MAJOR = 100;

const formatterCache = new Map<string, Intl.NumberFormat>();

function currencyFormatter(locale: Locale, numerals: NumeralStyle): Intl.NumberFormat {
  const key = `${locale}:${numerals}`;
  const cached = formatterCache.get(key);
  if (cached) return cached;

  const formatter = new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE", {
    style: "currency",
    currency: CURRENCY,
    numberingSystem: numerals === "arabic" ? "arab" : "latn",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  formatterCache.set(key, formatter);
  return formatter;
}

function assertInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${label} must be an integer number of fils, received ${value}`);
  }
}

export type MoneyFormatOptions = {
  locale?: Locale;
  numerals?: NumeralStyle;
};

/** Integer fils to a display string: 24000 -> "AED 240.00". */
export function formatMoney(minor: number, options?: MoneyFormatOptions): string {
  assertInteger(minor, "money");
  return currencyFormatter(
    options?.locale ?? "en",
    options?.numerals ?? "latin",
  ).format(minor / MINOR_PER_MAJOR);
}

// Accepts a plain number or correctly grouped thousands: 240, 1,240, 1,240.50.
// Commas in any other position are rejected rather than silently stripped.
const MONEY_INPUT = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/;

/**
 * Admin input to integer fils: "240" -> 24000, "1,240.5" -> 124050.
 * Returns null for anything ambiguous rather than guessing, because a silent
 * misparse here is a wrong price on the storefront.
 */
export function parseMoney(input: string): number | null {
  const cleaned = input.trim().replace(/\s+/g, "");
  if (!MONEY_INPUT.test(cleaned)) return null;

  const [whole = "", fraction = ""] = cleaned.replace(/,/g, "").split(".");
  const minor = Number(whole) * MINOR_PER_MAJOR + Number(fraction.padEnd(2, "0"));

  return Number.isSafeInteger(minor) ? minor : null;
}

/** Integer division rounded half-up, so VAT never drifts by a fil. */
export function divRoundHalfUp(numerator: number, denominator: number): number {
  assertInteger(numerator, "numerator");
  assertInteger(denominator, "denominator");
  if (denominator <= 0) {
    throw new TypeError(`denominator must be positive, received ${denominator}`);
  }
  return Math.floor((numerator * 2 + denominator) / (2 * denominator));
}

/**
 * The VAT already contained in a VAT-inclusive amount.
 * rateBp is in basis points: 500 = 5%.
 */
export function vatComponent(totalMinor: number, rateBp: number): number {
  assertInteger(totalMinor, "total");
  assertInteger(rateBp, "rateBp");
  if (totalMinor < 0) {
    throw new TypeError(`total must not be negative, received ${totalMinor}`);
  }
  if (rateBp < 0) {
    throw new TypeError(`rateBp must not be negative, received ${rateBp}`);
  }
  return divRoundHalfUp(totalMinor * rateBp, 10_000 + rateBp);
}
