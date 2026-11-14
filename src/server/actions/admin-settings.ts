"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseMoney } from "@/lib/money";
import { requireAdminAction } from "../auth/guard";
import { db } from "../db/client";
import { auditLog } from "../db/schema";
import {
  getStoreSettings,
  writeStoreSettings,
  type StoreSettings,
} from "../services/settings";

function backToSettings(error?: string): never {
  redirect(`/admin/settings${error ? `?error=${encodeURIComponent(error)}` : "?saved=1"}`);
}

function readMoney(value: FormDataEntryValue | null, label: string): number | string {
  const parsed = parseMoney(String(value ?? ""));
  if (parsed === null) return `Enter a valid ${label}.`;
  return parsed;
}

function readInt(
  value: FormDataEntryValue | null,
  label: string,
  min: number,
  max: number,
): number | string {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    return `Enter ${label} between ${min} and ${max}.`;
  }
  return number;
}

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex colour.");

export async function updateSettingsAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const before = await getStoreSettings();

  const name = String(formData.get("name") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const contactPhone = String(formData.get("contactPhone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const legalName = String(formData.get("legalName") ?? "").trim();
  const trn = String(formData.get("trn") ?? "").trim();
  const announcementText = String(formData.get("announcementText") ?? "").trim();
  const announcementHref = String(formData.get("announcementHref") ?? "").trim();
  const themeBrand = String(formData.get("themeBrand") ?? "").trim();
  const themeBrandSoft = String(formData.get("themeBrandSoft") ?? "").trim();
  const themeRadius = String(formData.get("themeRadius") ?? "").trim();

  if (name.length < 2) backToSettings("Give the store a name.");
  if (!z.string().email().safeParse(contactEmail).success) {
    backToSettings("Enter a valid contact email.");
  }
  if (announcementHref && (!announcementHref.startsWith("/") || announcementHref.startsWith("//"))) {
    backToSettings("The announcement link must be an internal path starting with /.");
  }
  if (!colorSchema.safeParse(themeBrand).success || !colorSchema.safeParse(themeBrandSoft).success) {
    backToSettings("Store colours must be six-digit hex values.");
  }
  if (!["0rem", "0.25rem", "0.5rem", "0.75rem", "1rem"].includes(themeRadius)) {
    backToSettings("Choose a valid corner radius.");
  }

  const taxRatePercent = Number(formData.get("taxRatePercent"));
  if (!Number.isFinite(taxRatePercent) || taxRatePercent < 0 || taxRatePercent > 100) {
    backToSettings("Enter a VAT rate between 0 and 100.");
  }

  const shippingFlatRateMinor = readMoney(formData.get("shippingFlatRate"), "flat shipping rate");
  if (typeof shippingFlatRateMinor === "string") backToSettings(shippingFlatRateMinor);

  const shippingFreeThresholdMinor = readMoney(
    formData.get("shippingFreeThreshold"),
    "free-shipping threshold",
  );
  if (typeof shippingFreeThresholdMinor === "string") {
    backToSettings(shippingFreeThresholdMinor);
  }

  const returnWindowDays = readInt(formData.get("returnWindowDays"), "return window", 0, 90);
  if (typeof returnWindowDays === "string") backToSettings(returnWindowDays);

  const lowStockThreshold = readInt(
    formData.get("lowStockThreshold"),
    "low-stock threshold",
    0,
    1_000,
  );
  if (typeof lowStockThreshold === "string") backToSettings(lowStockThreshold);

  const abandonedCartHours = readInt(
    formData.get("abandonedCartHours"),
    "abandoned-cart delay",
    1,
    168,
  );
  if (typeof abandonedCartHours === "string") backToSettings(abandonedCartHours);

  const after: StoreSettings = {
    ...before,
    name,
    contactEmail,
    contactPhone,
    address,
    legalName,
    trn,
    taxRateBp: Math.round(taxRatePercent * 100),
    taxInclusive: formData.get("taxInclusive") === "on",
    shippingFlatRateMinor,
    shippingFreeThresholdMinor,
    announcementText,
    announcementHref,
    announcementActive: formData.get("announcementActive") === "on",
    themeBrand,
    themeBrandSoft,
    themeRadius,
    returnWindowDays,
    lowStockThreshold,
    abandonedCartHours,
  };

  await writeStoreSettings(after, session.user.id);
  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "settings.update",
    entity: "settings",
    before,
    after,
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  backToSettings();
}
