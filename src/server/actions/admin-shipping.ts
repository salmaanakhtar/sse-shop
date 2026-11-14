"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseMoney } from "@/lib/money";
import { requireAdminAction } from "../auth/guard";
import { db } from "../db/client";
import { auditLog, shippingBands, shippingZones } from "../db/schema";
import {
  addShippingBand,
  deleteShippingBand,
  isEmirate,
  updateShippingBand,
  upsertShippingZone,
} from "../services/shipping";

function backToShipping(error?: string): never {
  redirect(`/admin/shipping${error ? `?error=${encodeURIComponent(error)}` : "?saved=1"}`);
}

function readWeightKg(value: FormDataEntryValue | null, label: string): number | string {
  const raw = String(value ?? "").trim();
  if (!raw) return `${label} is required.`;
  const kg = Number(raw);
  if (!Number.isFinite(kg) || kg < 0) return `Enter a valid ${label.toLowerCase()}.`;
  return Math.round(kg * 1_000);
}

function readOptionalWeightKg(
  value: FormDataEntryValue | null,
  label: string,
): number | null | string {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const kg = Number(raw);
  if (!Number.isFinite(kg) || kg < 0) return `Enter a valid ${label.toLowerCase()}.`;
  return Math.round(kg * 1_000);
}

export async function saveShippingZoneAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const emirate = String(formData.get("emirate") ?? "").trim();
  if (!isEmirate(emirate)) backToShipping("Choose one of the seven emirates.");

  const freeThresholdMinor = parseMoney(String(formData.get("freeThreshold") ?? ""));
  if (freeThresholdMinor === null) {
    backToShipping("Enter a valid free-delivery threshold.");
  }

  const active = formData.get("active") === "on";
  const [before] = await db
    .select()
    .from(shippingZones)
    .where(eq(shippingZones.emirate, emirate))
    .limit(1);

  const result = await upsertShippingZone({
    emirate,
    freeThresholdMinor,
    active,
  });
  if (!result.ok) backToShipping(result.error);

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: before ? "shipping.zone.update" : "shipping.zone.create",
    entity: "shipping_zones",
    entityId: result.data.id,
    before: before
      ? { freeThresholdMinor: before.freeThresholdMinor, active: before.active }
      : null,
    after: { emirate, freeThresholdMinor, active },
  });

  revalidatePath("/admin/shipping");
  revalidatePath("/checkout");
  backToShipping();
}

export async function addShippingBandAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const zoneId = String(formData.get("zoneId") ?? "").trim();
  if (!zoneId) backToShipping("Choose a zone.");

  const minWeightGrams = readWeightKg(formData.get("minKg"), "Minimum weight");
  if (typeof minWeightGrams === "string") backToShipping(minWeightGrams);

  const maxWeightGrams = readOptionalWeightKg(formData.get("maxKg"), "Maximum weight");
  if (typeof maxWeightGrams === "string") backToShipping(maxWeightGrams);

  const rateMinor = parseMoney(String(formData.get("rate") ?? ""));
  if (rateMinor === null) backToShipping("Enter a valid delivery charge.");

  const result = await addShippingBand({ zoneId, minWeightGrams, maxWeightGrams, rateMinor });
  if (!result.ok) backToShipping(result.error);

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "shipping.band.create",
    entity: "shipping_bands",
    entityId: result.data.id,
    after: { zoneId, minWeightGrams, maxWeightGrams, rateMinor },
  });

  revalidatePath("/admin/shipping");
  revalidatePath("/checkout");
  backToShipping();
}

export async function updateShippingBandAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) backToShipping("Choose a band.");

  const minWeightGrams = readWeightKg(formData.get("minKg"), "Minimum weight");
  if (typeof minWeightGrams === "string") backToShipping(minWeightGrams);

  const maxWeightGrams = readOptionalWeightKg(formData.get("maxKg"), "Maximum weight");
  if (typeof maxWeightGrams === "string") backToShipping(maxWeightGrams);

  const rateMinor = parseMoney(String(formData.get("rate") ?? ""));
  if (rateMinor === null) backToShipping("Enter a valid delivery charge.");

  const [before] = await db
    .select()
    .from(shippingBands)
    .where(eq(shippingBands.id, id))
    .limit(1);

  const result = await updateShippingBand({ id, minWeightGrams, maxWeightGrams, rateMinor });
  if (!result.ok) backToShipping(result.error);

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "shipping.band.update",
    entity: "shipping_bands",
    entityId: id,
    before: before
      ? {
          minWeightGrams: before.minWeightGrams,
          maxWeightGrams: before.maxWeightGrams,
          rateMinor: before.rateMinor,
        }
      : null,
    after: { minWeightGrams, maxWeightGrams, rateMinor },
  });

  revalidatePath("/admin/shipping");
  revalidatePath("/checkout");
  backToShipping();
}

export async function deleteShippingBandAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) backToShipping();

  const [before] = await db
    .select()
    .from(shippingBands)
    .where(eq(shippingBands.id, id))
    .limit(1);

  const result = await deleteShippingBand(id);
  if (!result.ok) backToShipping(result.error);

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "shipping.band.delete",
    entity: "shipping_bands",
    entityId: id,
    before: before
      ? {
          zoneId: before.zoneId,
          minWeightGrams: before.minWeightGrams,
          maxWeightGrams: before.maxWeightGrams,
          rateMinor: before.rateMinor,
        }
      : null,
  });

  revalidatePath("/admin/shipping");
  revalidatePath("/checkout");
  backToShipping();
}
