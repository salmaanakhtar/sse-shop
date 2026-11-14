import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { EMIRATES } from "@/lib/address";
import { translate, type Locale } from "@/lib/i18n";

export type AddressFormValues = {
  id?: string;
  label?: string;
  fullName?: string;
  phone?: string;
  emirate?: string;
  street?: string;
  building?: string;
  area?: string;
  poBox?: string;
  notes?: string;
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
};

export function AddressForm({
  action,
  values,
  submitLabel,
  error,
  locale = "en",
}: {
  action: (formData: FormData) => void | Promise<void>;
  values?: AddressFormValues;
  submitLabel: string;
  error?: string;
  locale?: Locale;
}) {
  return (
    <form action={action} className="space-y-5 rounded-xl border border-line bg-surface p-6">
      {values?.id ? <input type="hidden" name="id" value={values.id} /> : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="label">{translate(locale, "addresses.label")}</Label>
          <Input
            id="label"
            name="label"
            defaultValue={values?.label ?? ""}
            maxLength={40}
            placeholder="Home, Office"
          />
        </div>
        <div>
          <Label htmlFor="fullName">{translate(locale, "addresses.recipient")}</Label>
          <Input
            id="fullName"
            name="fullName"
            required
            autoComplete="name"
            maxLength={120}
            defaultValue={values?.fullName ?? ""}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="phone">{translate(locale, "checkout.mobile")}</Label>
          <Input
            id="phone"
            name="phone"
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="+971501234567"
            pattern="\+971\d{9}"
            title="+971 followed by 9 digits"
            defaultValue={values?.phone ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="emirate">{translate(locale, "checkout.emirate")}</Label>
          <select
            id="emirate"
            name="emirate"
            required
            defaultValue={values?.emirate ?? "Dubai"}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand/30"
          >
            {EMIRATES.map((emirate) => (
              <option key={emirate} value={emirate}>
                {emirate}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="building">{translate(locale, "checkout.building")}</Label>
          <Input
            id="building"
            name="building"
            required
            autoComplete="address-line1"
            maxLength={120}
            defaultValue={values?.building ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="street">{translate(locale, "checkout.street")}</Label>
          <Input
            id="street"
            name="street"
            required
            autoComplete="address-line2"
            maxLength={160}
            defaultValue={values?.street ?? ""}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="area">{translate(locale, "checkout.area")}</Label>
          <Input
            id="area"
            name="area"
            autoComplete="address-level3"
            maxLength={120}
            placeholder="Jumeirah Lakes Towers"
            defaultValue={values?.area ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="poBox">{translate(locale, "checkout.poBox")}</Label>
          <Input
            id="poBox"
            name="poBox"
            inputMode="numeric"
            maxLength={20}
            defaultValue={values?.poBox ?? ""}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="notes">{translate(locale, "checkout.notes")}</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={500}
          placeholder="Gate code, landmark, preferred time"
          defaultValue={values?.notes ?? ""}
        />
      </div>

      <div className="flex flex-wrap gap-5 border-t border-line pt-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="isDefaultShipping"
            defaultChecked={values?.isDefaultShipping ?? false}
            className="size-4"
          />
          {translate(locale, "addresses.deliveryDefault")}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="isDefaultBilling"
            defaultChecked={values?.isDefaultBilling ?? false}
            className="size-4"
          />
          {translate(locale, "addresses.billingDefault")}
        </label>
      </div>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
