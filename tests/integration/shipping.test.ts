import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { shippingBands, shippingZones } from "@/server/db/schema";
import {
  addShippingBand,
  deleteShippingBand,
  getShippingZone,
  quoteEmirates,
  resolveShippingRate,
  updateShippingBand,
  upsertShippingZone,
} from "@/server/services/shipping";

async function seedDubaiZone() {
  const zone = await upsertShippingZone({
    emirate: "Dubai",
    freeThresholdMinor: 20_000,
    active: true,
  });
  expect(zone.ok).toBe(true);
  if (!zone.ok) throw new Error("could not create the zone");

  const first = await addShippingBand({
    zoneId: zone.data.id,
    minWeightGrams: 0,
    maxWeightGrams: 2_000,
    rateMinor: 2_000,
  });
  const second = await addShippingBand({
    zoneId: zone.data.id,
    minWeightGrams: 2_001,
    maxWeightGrams: 5_000,
    rateMinor: 3_000,
  });
  const third = await addShippingBand({
    zoneId: zone.data.id,
    minWeightGrams: 5_001,
    maxWeightGrams: null,
    rateMinor: 4_000,
  });
  expect(first.ok && second.ok && third.ok).toBe(true);

  return zone.data.id;
}

describe("shipping zones", () => {
  beforeEach(async () => {
    // Zones cascade to bands. Each test starts from an empty shipping table.
    await db.delete(shippingZones);
  });

  it("resolves the band for the emirate and cart weight", async () => {
    await seedDubaiZone();

    expect(await resolveShippingRate("Dubai", 5_000, 1_500)).toEqual({
      rateMinor: 2_000,
      source: "zone",
    });
    expect(await resolveShippingRate("Dubai", 5_000, 3_000)).toEqual({
      rateMinor: 3_000,
      source: "zone",
    });
    expect(await resolveShippingRate("Dubai", 5_000, 8_000)).toEqual({
      rateMinor: 4_000,
      source: "zone",
    });
    expect(await resolveShippingRate("Dubai", 20_000, 3_000)).toEqual({
      rateMinor: 0,
      source: "zone",
    });
  });

  it("falls back to the flat rate for an unconfigured emirate", async () => {
    await seedDubaiZone();

    // Defaults: AED 20 flat below AED 200.
    expect(await resolveShippingRate("Sharjah", 5_000, 1_500)).toEqual({
      rateMinor: 2_000,
      source: "fallback",
    });
    expect(await resolveShippingRate("Sharjah", 20_000, 1_500)).toEqual({
      rateMinor: 0,
      source: "fallback",
    });
  });

  it("falls back when the zone is inactive", async () => {
    const zoneId = await seedDubaiZone();

    await db.update(shippingZones).set({ active: false }).where(eq(shippingZones.id, zoneId));
    expect((await resolveShippingRate("Dubai", 5_000, 1_500)).source).toBe("fallback");
  });

  it("rejects overlapping bands and allows moving a band", async () => {
    const zoneId = await seedDubaiZone();

    const overlap = await addShippingBand({
      zoneId,
      minWeightGrams: 1_000,
      maxWeightGrams: 3_000,
      rateMinor: 2_500,
    });
    expect(overlap.ok).toBe(false);

    const [band] = await db
      .select()
      .from(shippingBands)
      .where(eq(shippingBands.zoneId, zoneId))
      .limit(1);
    if (!band) throw new Error("missing band");

    const move = await updateShippingBand({
      id: band.id,
      minWeightGrams: 0,
      maxWeightGrams: 900,
      rateMinor: 1_500,
    });
    expect(move.ok).toBe(true);
  });

  it("quotes every emirate in one pass", async () => {
    await seedDubaiZone();

    const quotes = await quoteEmirates(5_000, 1_500);
    expect(quotes.Dubai).toEqual({ rateMinor: 2_000, source: "zone" });
    expect(quotes["Abu Dhabi"]).toEqual({ rateMinor: 2_000, source: "fallback" });
    expect(Object.keys(quotes)).toHaveLength(7);
  });

  it("deletes a zone's band and keeps the zone", async () => {
    await seedDubaiZone();
    const zone = await getShippingZone("Dubai");
    expect(zone?.bands).toHaveLength(3);

    const removed = await deleteShippingBand(zone!.bands[0]!.id);
    expect(removed.ok).toBe(true);
    expect((await getShippingZone("Dubai"))?.bands).toHaveLength(2);
  });
});
