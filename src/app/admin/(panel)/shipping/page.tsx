import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { EMIRATES } from "@/lib/address";
import { formatMoney } from "@/lib/money";
import {
  addShippingBandAction,
  deleteShippingBandAction,
  saveShippingZoneAction,
  updateShippingBandAction,
} from "@/server/actions/admin-shipping";
import { requireAdminPage } from "@/server/auth/guard";
import { getStoreSettings } from "@/server/services/settings";
import { listShippingZones } from "@/server/services/shipping";

export const metadata = { title: "Shipping" };

function kg(grams: number): string {
  return grams % 1_000 === 0 ? String(grams / 1_000) : (grams / 1_000).toFixed(2);
}

function bandLabel(min: number, max: number | null): string {
  return max === null ? `${kg(min)} kg and above` : `${kg(min)}–${kg(max)} kg`;
}

export default async function AdminShippingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireAdminPage();
  const [{ error, saved }, zones, settings] = await Promise.all([
    searchParams,
    listShippingZones(false),
    getStoreSettings(),
  ]);
  const byEmirate = new Map(zones.map((zone) => [zone.emirate, zone]));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Shipping</h1>
        <p className="mt-1 text-sm text-muted">
          One zone per emirate, with weight bands and a per-zone free-delivery threshold. The store
          flat rate of {formatMoney(settings.shippingFlatRateMinor)} remains the fallback when a zone
          is inactive or a weight has no band.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Shipping saved.
        </p>
      ) : null}

      {EMIRATES.map((emirate) => {
        const zone = byEmirate.get(emirate);
        return (
          <section key={emirate} className="rounded-xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">{emirate}</h2>
                <p className="text-xs text-muted">
                  {zone
                    ? `${zone.bands.length} ${zone.bands.length === 1 ? "band" : "bands"} · free over ${formatMoney(zone.freeThresholdMinor)}`
                    : "Not configured — the store flat rate applies."}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  zone?.active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {zone ? (zone.active ? "active" : "inactive") : "fallback"}
              </span>
            </div>

            <form action={saveShippingZoneAction} className="mt-4 flex flex-wrap items-end gap-3">
              <input type="hidden" name="emirate" value={emirate} />
              <div className="w-44">
                <Label htmlFor={`free-${emirate}`}>Free delivery over (AED)</Label>
                <Input
                  id={`free-${emirate}`}
                  name="freeThreshold"
                  inputMode="decimal"
                  defaultValue={((zone?.freeThresholdMinor ?? settings.shippingFreeThresholdMinor) / 100).toFixed(2)}
                />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={zone?.active ?? true}
                  className="size-4"
                />
                Active
              </label>
              <Button type="submit" size="sm" variant="secondary">
                {zone ? "Save zone" : "Create zone"}
              </Button>
            </form>

            {zone ? (
              <div className="mt-5 border-t border-line pt-4">
                <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
                  Weight bands
                </h3>

                {zone.bands.length > 0 ? (
                  <ul className="mt-3 space-y-3 text-sm">
                    {zone.bands.map((band) => (
                      <li key={band.id} className="rounded-lg border border-line bg-page/40 p-3">
                        <form
                          action={updateShippingBandAction}
                          className="flex flex-wrap items-end gap-2"
                        >
                          <input type="hidden" name="id" value={band.id} />
                          <div className="w-24">
                            <Label htmlFor={`band-min-${band.id}`}>From (kg)</Label>
                            <Input
                              id={`band-min-${band.id}`}
                              name="minKg"
                              inputMode="decimal"
                              required
                              defaultValue={kg(band.minWeightGrams)}
                            />
                          </div>
                          <div className="w-24">
                            <Label htmlFor={`band-max-${band.id}`}>To (kg)</Label>
                            <Input
                              id={`band-max-${band.id}`}
                              name="maxKg"
                              inputMode="decimal"
                              placeholder="No limit"
                              defaultValue={
                                band.maxWeightGrams === null ? "" : kg(band.maxWeightGrams)
                              }
                            />
                          </div>
                          <div className="w-28">
                            <Label htmlFor={`band-rate-${band.id}`}>Charge (AED)</Label>
                            <Input
                              id={`band-rate-${band.id}`}
                              name="rate"
                              inputMode="decimal"
                              required
                              defaultValue={(band.rateMinor / 100).toFixed(2)}
                            />
                          </div>
                          <Button type="submit" size="sm" variant="secondary">
                            Save band
                          </Button>
                        </form>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-muted">
                            {bandLabel(band.minWeightGrams, band.maxWeightGrams)}
                          </span>
                          <form action={deleteShippingBandAction}>
                            <input type="hidden" name="id" value={band.id} />
                            <ConfirmSubmitButton
                              type="submit"
                              message={`Delete the ${bandLabel(band.minWeightGrams, band.maxWeightGrams)} band?`}
                              className="text-xs text-muted underline-offset-4 hover:text-red-600 hover:underline"
                            >
                              Delete
                            </ConfirmSubmitButton>
                          </form>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted">
                    No bands yet, so this zone falls back to the flat rate.
                  </p>
                )}

                <form action={addShippingBandAction} className="mt-4 flex flex-wrap items-end gap-3">
                  <input type="hidden" name="zoneId" value={zone.id} />
                  <div className="w-28">
                    <Label htmlFor={`min-${zone.id}`}>From (kg)</Label>
                    <Input id={`min-${zone.id}`} name="minKg" inputMode="decimal" required />
                  </div>
                  <div className="w-28">
                    <Label htmlFor={`max-${zone.id}`}>To (kg)</Label>
                    <Input
                      id={`max-${zone.id}`}
                      name="maxKg"
                      inputMode="decimal"
                      placeholder="No limit"
                    />
                  </div>
                  <div className="w-32">
                    <Label htmlFor={`rate-${zone.id}`}>Charge (AED)</Label>
                    <Input id={`rate-${zone.id}`} name="rate" inputMode="decimal" required />
                  </div>
                  <Button type="submit" size="sm" variant="secondary">
                    Add band
                  </Button>
                </form>
                <p className="mt-1.5 text-xs text-muted">
                  Leave “To” empty for the open-ended top band.
                </p>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
