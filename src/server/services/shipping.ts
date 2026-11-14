import { and, asc, eq, ne } from "drizzle-orm";
import { EMIRATES } from "@/lib/address";
import { fail, ok, type Result } from "@/lib/result";
import {
  shippingFor,
  zoneShippingFor,
  type ShippingBand,
  type ShippingZoneRule,
} from "@/lib/shipping";
import { db } from "../db/client";
import { shippingBands, shippingZones } from "../db/schema";
import { getStoreSettings } from "./settings";

export type Emirate = (typeof EMIRATES)[number];

export type ShippingBandView = typeof shippingBands.$inferSelect;
export type ShippingZoneView = typeof shippingZones.$inferSelect & {
  bands: ShippingBandView[];
};

export type ShippingResolution = {
  rateMinor: number;
  source: "zone" | "fallback";
};

function toRule(zone: ShippingZoneView): ShippingZoneRule {
  const bands: ShippingBand[] = zone.bands.map((band) => ({
    minWeightGrams: band.minWeightGrams,
    maxWeightGrams: band.maxWeightGrams,
    rateMinor: band.rateMinor,
  }));
  return { freeThresholdMinor: zone.freeThresholdMinor, bands };
}

export async function listShippingZones(activeOnly = false): Promise<ShippingZoneView[]> {
  const [zones, bands] = await Promise.all([
    activeOnly
      ? db
          .select()
          .from(shippingZones)
          .where(eq(shippingZones.active, true))
          .orderBy(asc(shippingZones.position), asc(shippingZones.emirate))
      : db
          .select()
          .from(shippingZones)
          .orderBy(asc(shippingZones.position), asc(shippingZones.emirate)),
    db.select().from(shippingBands).orderBy(asc(shippingBands.minWeightGrams)),
  ]);

  const byZone = new Map<string, ShippingBandView[]>();
  for (const band of bands) {
    const current = byZone.get(band.zoneId) ?? [];
    current.push(band);
    byZone.set(band.zoneId, current);
  }

  return zones.map((zone) => ({ ...zone, bands: byZone.get(zone.id) ?? [] }));
}

export async function getShippingZone(emirate: string): Promise<ShippingZoneView | null> {
  const [zone] = await db
    .select()
    .from(shippingZones)
    .where(eq(shippingZones.emirate, emirate))
    .limit(1);
  if (!zone) return null;

  const bands = await db
    .select()
    .from(shippingBands)
    .where(eq(shippingBands.zoneId, zone.id))
    .orderBy(asc(shippingBands.minWeightGrams));

  return { ...zone, bands };
}

/**
 * Resolve the delivery charge for one emirate. An active zone with a band for
 * the weight wins; otherwise the store's flat-rate fallback applies. This is
 * the only place checkout and the cart preview can disagree, and they do not:
 * both call the same service for the same emirate and weight.
 */
export async function resolveShippingRate(
  emirate: string,
  subtotalMinor: number,
  weightGrams: number,
): Promise<ShippingResolution> {
  const zone = await getShippingZone(emirate);
  if (zone?.active) {
    const rate = zoneShippingFor(subtotalMinor, weightGrams, toRule(zone));
    if (rate !== null) return { rateMinor: rate, source: "zone" };
  }

  const settings = await getStoreSettings();
  const rateMinor = shippingFor(subtotalMinor, {
    flatRateMinor: settings.shippingFlatRateMinor,
    freeThresholdMinor: settings.shippingFreeThresholdMinor,
  });
  return { rateMinor, source: "fallback" };
}

/**
 * All seven emirates in one pass, for the checkout summary. Inactive or
 * incomplete zones fall back to the flat rate exactly like placement does.
 */
export async function quoteEmirates(
  subtotalMinor: number,
  weightGrams: number,
): Promise<Record<Emirate, ShippingResolution>> {
  const [zones, settings] = await Promise.all([
    listShippingZones(true),
    getStoreSettings(),
  ]);

  const byEmirate = new Map(zones.map((zone) => [zone.emirate, zone]));
  const fallbackRate = shippingFor(subtotalMinor, {
    flatRateMinor: settings.shippingFlatRateMinor,
    freeThresholdMinor: settings.shippingFreeThresholdMinor,
  });

  const quotes = {} as Record<Emirate, ShippingResolution>;
  for (const emirate of EMIRATES) {
    const zone = byEmirate.get(emirate);
    const rate = zone ? zoneShippingFor(subtotalMinor, weightGrams, toRule(zone)) : null;
    quotes[emirate] =
      rate === null
        ? { rateMinor: fallbackRate, source: "fallback" }
        : { rateMinor: rate, source: "zone" };
  }
  return quotes;
}

export function totalWeightGrams(
  lines: readonly { weightGrams: number | null; quantity: number }[],
): number {
  return lines.reduce(
    (sum, line) => sum + Math.max(0, line.weightGrams ?? 0) * line.quantity,
    0,
  );
}

export function isEmirate(value: string): value is Emirate {
  return (EMIRATES as readonly string[]).includes(value);
}

export async function upsertShippingZone(input: {
  emirate: string;
  freeThresholdMinor: number;
  active: boolean;
}): Promise<Result<{ id: string }>> {
  if (!isEmirate(input.emirate)) return fail("Choose one of the seven emirates.");
  if (!Number.isInteger(input.freeThresholdMinor) || input.freeThresholdMinor < 0) {
    return fail("Enter a valid free-delivery threshold.");
  }

  const [zone] = await db
    .insert(shippingZones)
    .values({
      emirate: input.emirate,
      name: input.emirate,
      freeThresholdMinor: input.freeThresholdMinor,
      active: input.active,
      position: EMIRATES.indexOf(input.emirate),
    })
    .onConflictDoUpdate({
      target: shippingZones.emirate,
      set: {
        freeThresholdMinor: input.freeThresholdMinor,
        active: input.active,
        updatedAt: new Date(),
      },
    })
    .returning({ id: shippingZones.id });

  if (!zone) return fail("Could not save the shipping zone.");
  return ok(zone);
}

function rangesOverlap(
  aMin: number,
  aMax: number | null,
  bMin: number,
  bMax: number | null,
): boolean {
  return aMin <= (bMax ?? Number.MAX_SAFE_INTEGER) && bMin <= (aMax ?? Number.MAX_SAFE_INTEGER);
}

export async function addShippingBand(input: {
  zoneId: string;
  minWeightGrams: number;
  maxWeightGrams: number | null;
  rateMinor: number;
}): Promise<Result<{ id: string }>> {
  if (!Number.isInteger(input.minWeightGrams) || input.minWeightGrams < 0) {
    return fail("Enter a valid minimum weight.");
  }
  if (
    input.maxWeightGrams !== null &&
    (!Number.isInteger(input.maxWeightGrams) || input.maxWeightGrams < input.minWeightGrams)
  ) {
    return fail("The maximum weight must be at or above the minimum.");
  }
  if (!Number.isInteger(input.rateMinor) || input.rateMinor < 0) {
    return fail("Enter a valid delivery charge.");
  }

  const [zone] = await db
    .select({ id: shippingZones.id })
    .from(shippingZones)
    .where(eq(shippingZones.id, input.zoneId))
    .limit(1);
  if (!zone) return fail("That shipping zone could not be found.");

  const existing = await db
    .select()
    .from(shippingBands)
    .where(eq(shippingBands.zoneId, input.zoneId));

  if (
    existing.some((band) =>
      rangesOverlap(
        input.minWeightGrams,
        input.maxWeightGrams,
        band.minWeightGrams,
        band.maxWeightGrams,
      ),
    )
  ) {
    return fail("That weight range overlaps an existing band.");
  }

  const [band] = await db
    .insert(shippingBands)
    .values({
      zoneId: input.zoneId,
      minWeightGrams: input.minWeightGrams,
      maxWeightGrams: input.maxWeightGrams,
      rateMinor: input.rateMinor,
      position: existing.length,
    })
    .returning({ id: shippingBands.id });

  if (!band) return fail("Could not add the band.");
  return ok(band);
}

export async function updateShippingBand(input: {
  id: string;
  minWeightGrams: number;
  maxWeightGrams: number | null;
  rateMinor: number;
}): Promise<Result<{ id: string }>> {
  const [current] = await db
    .select()
    .from(shippingBands)
    .where(eq(shippingBands.id, input.id))
    .limit(1);
  if (!current) return fail("That band could not be found.");

  if (!Number.isInteger(input.minWeightGrams) || input.minWeightGrams < 0) {
    return fail("Enter a valid minimum weight.");
  }
  if (
    input.maxWeightGrams !== null &&
    (!Number.isInteger(input.maxWeightGrams) || input.maxWeightGrams < input.minWeightGrams)
  ) {
    return fail("The maximum weight must be at or above the minimum.");
  }
  if (!Number.isInteger(input.rateMinor) || input.rateMinor < 0) {
    return fail("Enter a valid delivery charge.");
  }

  const siblings = await db
    .select()
    .from(shippingBands)
    .where(and(eq(shippingBands.zoneId, current.zoneId), ne(shippingBands.id, input.id)));

  if (
    siblings.some((band) =>
      rangesOverlap(
        input.minWeightGrams,
        input.maxWeightGrams,
        band.minWeightGrams,
        band.maxWeightGrams,
      ),
    )
  ) {
    return fail("That weight range overlaps another band.");
  }

  await db
    .update(shippingBands)
    .set({
      minWeightGrams: input.minWeightGrams,
      maxWeightGrams: input.maxWeightGrams,
      rateMinor: input.rateMinor,
      updatedAt: new Date(),
    })
    .where(eq(shippingBands.id, input.id));

  return ok({ id: input.id });
}

export async function deleteShippingBand(id: string): Promise<Result<{ deleted: true }>> {
  const [deleted] = await db
    .delete(shippingBands)
    .where(eq(shippingBands.id, id))
    .returning({ id: shippingBands.id });
  if (!deleted) return fail("That band could not be found.");
  return ok({ deleted: true });
}
