import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { settings } from "../db/schema";

export type StoreSettings = {
  name: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  legalName: string;
  trn: string;
  taxRateBp: number;
  taxInclusive: boolean;
  shippingFlatRateMinor: number;
  shippingFreeThresholdMinor: number;
  announcementText: string;
  announcementHref: string;
  announcementActive: boolean;
  themeBrand: string;
  themeBrandSoft: string;
  themeRadius: string;
  returnWindowDays: number;
  lowStockThreshold: number;
  abandonedCartHours: number;
};

export const SETTING_DEFAULTS: StoreSettings = {
  name: "sse-shop",
  contactEmail: "hello@example.com",
  contactPhone: "",
  address: "",
  legalName: "sse-shop",
  trn: "",
  taxRateBp: 500,
  taxInclusive: true,
  shippingFlatRateMinor: 2_000,
  shippingFreeThresholdMinor: 20_000,
  announcementText: "",
  announcementHref: "",
  announcementActive: false,
  themeBrand: "#c026d3",
  themeBrandSoft: "#fae8ff",
  themeRadius: "0.5rem",
  returnWindowDays: 14,
  lowStockThreshold: 5,
  abandonedCartHours: 4,
};

export const SETTING_KEYS: Record<keyof StoreSettings, string> = {
  name: "store.name",
  contactEmail: "store.contact_email",
  contactPhone: "store.contact_phone",
  address: "store.address",
  legalName: "store.legal_name",
  trn: "store.trn",
  taxRateBp: "tax.rate_bp",
  taxInclusive: "tax.inclusive",
  shippingFlatRateMinor: "shipping.flat_rate_minor",
  shippingFreeThresholdMinor: "shipping.free_threshold_minor",
  announcementText: "store.announcement_text",
  announcementHref: "store.announcement_href",
  announcementActive: "store.announcement_active",
  themeBrand: "theme.brand",
  themeBrandSoft: "theme.brand_soft",
  themeRadius: "theme.radius",
  returnWindowDays: "returns.window_days",
  lowStockThreshold: "inventory.low_stock_threshold",
  abandonedCartHours: "cart.abandoned_hours",
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
    name: asString(byKey.get(SETTING_KEYS.name), SETTING_DEFAULTS.name),
    contactEmail: asString(byKey.get(SETTING_KEYS.contactEmail), SETTING_DEFAULTS.contactEmail),
    contactPhone: asString(byKey.get(SETTING_KEYS.contactPhone), SETTING_DEFAULTS.contactPhone),
    address: asString(byKey.get(SETTING_KEYS.address), SETTING_DEFAULTS.address),
    legalName: asString(byKey.get(SETTING_KEYS.legalName), SETTING_DEFAULTS.legalName),
    trn: asString(byKey.get(SETTING_KEYS.trn), SETTING_DEFAULTS.trn),
    taxRateBp: asNonNegativeInt(byKey.get(SETTING_KEYS.taxRateBp), SETTING_DEFAULTS.taxRateBp),
    taxInclusive: asBoolean(byKey.get(SETTING_KEYS.taxInclusive), SETTING_DEFAULTS.taxInclusive),
    shippingFlatRateMinor: asNonNegativeInt(
      byKey.get(SETTING_KEYS.shippingFlatRateMinor),
      SETTING_DEFAULTS.shippingFlatRateMinor,
    ),
    shippingFreeThresholdMinor: asNonNegativeInt(
      byKey.get(SETTING_KEYS.shippingFreeThresholdMinor),
      SETTING_DEFAULTS.shippingFreeThresholdMinor,
    ),
    announcementText: asString(
      byKey.get(SETTING_KEYS.announcementText),
      SETTING_DEFAULTS.announcementText,
    ),
    announcementHref: asString(
      byKey.get(SETTING_KEYS.announcementHref),
      SETTING_DEFAULTS.announcementHref,
    ),
    announcementActive: asBoolean(
      byKey.get(SETTING_KEYS.announcementActive),
      SETTING_DEFAULTS.announcementActive,
    ),
    themeBrand: asString(byKey.get(SETTING_KEYS.themeBrand), SETTING_DEFAULTS.themeBrand),
    themeBrandSoft: asString(
      byKey.get(SETTING_KEYS.themeBrandSoft),
      SETTING_DEFAULTS.themeBrandSoft,
    ),
    themeRadius: asString(byKey.get(SETTING_KEYS.themeRadius), SETTING_DEFAULTS.themeRadius),
    returnWindowDays: asNonNegativeInt(
      byKey.get(SETTING_KEYS.returnWindowDays),
      SETTING_DEFAULTS.returnWindowDays,
    ),
    lowStockThreshold: asNonNegativeInt(
      byKey.get(SETTING_KEYS.lowStockThreshold),
      SETTING_DEFAULTS.lowStockThreshold,
    ),
    abandonedCartHours: asNonNegativeInt(
      byKey.get(SETTING_KEYS.abandonedCartHours),
      SETTING_DEFAULTS.abandonedCartHours,
    ),
  };
});

export async function writeStoreSettings(
  values: StoreSettings,
  actorUserId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [key, settingKey] of Object.entries(SETTING_KEYS) as [
      keyof StoreSettings,
      string,
    ][]) {
      await tx
        .insert(settings)
        .values({
          key: settingKey,
          value: values[key] as unknown as object,
          updatedBy: actorUserId,
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: values[key] as unknown as object,
            updatedBy: actorUserId,
            updatedAt: new Date(),
          },
        });
    }
  });
}

export async function getSettingRow(key: string) {
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return row ?? null;
}
