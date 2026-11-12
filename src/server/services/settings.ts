import { cache } from "react";
import { db } from "../db/client";
import { settings } from "../db/schema";

export type StoreSettings = {
  name: string;
  contactEmail: string;
  taxRateBp: number;
  taxInclusive: boolean;
  shippingFlatRateMinor: number;
  shippingFreeThresholdMinor: number;
};

export const SETTING_DEFAULTS: StoreSettings = {
  name: "sse-shop",
  contactEmail: "hello@example.com",
  taxRateBp: 500,
  taxInclusive: true,
  shippingFlatRateMinor: 2_000,
  shippingFreeThresholdMinor: 20_000,
};

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function asNonNegativeInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Read once per request. Settings are small, and caching here keeps a cart
 * render from issuing the same query three times.
 */
export const getStoreSettings = cache(async (): Promise<StoreSettings> => {
  const rows = await db.select().from(settings);
  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  return {
    name: asString(byKey.get("store.name"), SETTING_DEFAULTS.name),
    contactEmail: asString(byKey.get("store.contact_email"), SETTING_DEFAULTS.contactEmail),
    taxRateBp: asNonNegativeInt(byKey.get("tax.rate_bp"), SETTING_DEFAULTS.taxRateBp),
    taxInclusive: asBoolean(byKey.get("tax.inclusive"), SETTING_DEFAULTS.taxInclusive),
    shippingFlatRateMinor: asNonNegativeInt(
      byKey.get("shipping.flat_rate_minor"),
      SETTING_DEFAULTS.shippingFlatRateMinor,
    ),
    shippingFreeThresholdMinor: asNonNegativeInt(
      byKey.get("shipping.free_threshold_minor"),
      SETTING_DEFAULTS.shippingFreeThresholdMinor,
    ),
  };
});
