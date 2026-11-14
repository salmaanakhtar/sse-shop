import { updateSettingsAction } from "@/server/actions/admin-settings";
import { requireAdminPage } from "@/server/auth/guard";
import { getStoreSettings } from "@/server/services/settings";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";

export const metadata = { title: "Settings" };

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireAdminPage();
  const [{ error, saved }, settings] = await Promise.all([
    searchParams,
    getStoreSettings(),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Store identity, legal details, shipping fallback, inventory thresholds, announcement bar,
          and storefront theme tokens.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Settings saved.
        </p>
      ) : null}

      <form action={updateSettingsAction} className="space-y-6">
        <section className="space-y-4 rounded-xl border border-line bg-surface p-6">
          <h2 className="text-sm font-semibold">Store identity</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="settings-name">Store name</Label>
              <Input id="settings-name" name="name" required defaultValue={settings.name} />
            </div>
            <div>
              <Label htmlFor="settings-email">Contact email</Label>
              <Input
                id="settings-email"
                name="contactEmail"
                type="email"
                required
                defaultValue={settings.contactEmail}
              />
            </div>
            <div>
              <Label htmlFor="settings-phone">Contact phone</Label>
              <Input
                id="settings-phone"
                name="contactPhone"
                defaultValue={settings.contactPhone}
                placeholder="+971 50 123 4567"
              />
            </div>
            <div>
              <Label htmlFor="settings-legal-name">Legal name</Label>
              <Input
                id="settings-legal-name"
                name="legalName"
                defaultValue={settings.legalName}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="settings-address">Registered address</Label>
            <Textarea
              id="settings-address"
              name="address"
              rows={2}
              defaultValue={settings.address}
            />
          </div>
          <div className="max-w-xs">
            <Label htmlFor="settings-trn">TRN</Label>
            <Input
              id="settings-trn"
              name="trn"
              maxLength={30}
              defaultValue={settings.trn}
              placeholder="15-digit UAE TRN"
            />
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-line bg-surface p-6">
          <h2 className="text-sm font-semibold">Tax and shipping fallback</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="settings-tax">VAT rate (%)</Label>
              <Input
                id="settings-tax"
                name="taxRatePercent"
                type="number"
                step="0.01"
                min={0}
                max={100}
                required
                defaultValue={(settings.taxRateBp / 100).toFixed(2)}
              />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                name="taxInclusive"
                defaultChecked={settings.taxInclusive}
                className="size-4"
              />
              Prices include VAT
            </label>
            <div>
              <Label htmlFor="settings-shipping">Flat shipping rate (AED)</Label>
              <Input
                id="settings-shipping"
                name="shippingFlatRate"
                inputMode="decimal"
                required
                defaultValue={(settings.shippingFlatRateMinor / 100).toFixed(2)}
              />
            </div>
            <div>
              <Label htmlFor="settings-free-shipping">Free shipping over (AED)</Label>
              <Input
                id="settings-free-shipping"
                name="shippingFreeThreshold"
                inputMode="decimal"
                required
                defaultValue={(settings.shippingFreeThresholdMinor / 100).toFixed(2)}
              />
            </div>
          </div>
          <p className="text-xs text-muted">
            These values remain the fallback until shipping zones and weight bands are configured.
          </p>
        </section>

        <section className="space-y-4 rounded-xl border border-line bg-surface p-6">
          <h2 className="text-sm font-semibold">Operations</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="settings-returns">Return window (days)</Label>
              <Input
                id="settings-returns"
                name="returnWindowDays"
                type="number"
                min={0}
                max={90}
                required
                defaultValue={settings.returnWindowDays}
              />
            </div>
            <div>
              <Label htmlFor="settings-low-stock">Low-stock threshold</Label>
              <Input
                id="settings-low-stock"
                name="lowStockThreshold"
                type="number"
                min={0}
                max={1000}
                required
                defaultValue={settings.lowStockThreshold}
              />
            </div>
            <div>
              <Label htmlFor="settings-cart">Abandoned cart (hours)</Label>
              <Input
                id="settings-cart"
                name="abandonedCartHours"
                type="number"
                min={1}
                max={168}
                required
                defaultValue={settings.abandonedCartHours}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-line bg-surface p-6">
          <h2 className="text-sm font-semibold">Announcement bar</h2>
          <div>
            <Label htmlFor="settings-announcement">Text</Label>
            <Input
              id="settings-announcement"
              name="announcementText"
              maxLength={160}
              defaultValue={settings.announcementText}
              placeholder="Free delivery over AED 200"
            />
          </div>
          <div>
            <Label htmlFor="settings-announcement-href">Link (optional)</Label>
            <Input
              id="settings-announcement-href"
              name="announcementHref"
              maxLength={500}
              defaultValue={settings.announcementHref}
              placeholder="/collections/featured"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="announcementActive"
              defaultChecked={settings.announcementActive}
              className="size-4"
            />
            Show the announcement bar
          </label>
        </section>

        <section className="space-y-4 rounded-xl border border-line bg-surface p-6">
          <h2 className="text-sm font-semibold">Storefront theme</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="settings-brand">Brand colour</Label>
              <Input
                id="settings-brand"
                name="themeBrand"
                type="color"
                defaultValue={settings.themeBrand}
                className="h-10 w-full p-1"
              />
            </div>
            <div>
              <Label htmlFor="settings-brand-soft">Soft brand colour</Label>
              <Input
                id="settings-brand-soft"
                name="themeBrandSoft"
                type="color"
                defaultValue={settings.themeBrandSoft}
                className="h-10 w-full p-1"
              />
            </div>
            <div>
              <Label htmlFor="settings-radius">Corner radius</Label>
              <select
                id="settings-radius"
                name="themeRadius"
                defaultValue={settings.themeRadius}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              >
                <option value="0rem">Square</option>
                <option value="0.25rem">Small</option>
                <option value="0.5rem">Medium</option>
                <option value="0.75rem">Large</option>
                <option value="1rem">Extra large</option>
              </select>
            </div>
          </div>
        </section>

        <Button type="submit">Save settings</Button>
      </form>
    </div>
  );
}
