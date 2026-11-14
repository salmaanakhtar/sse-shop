"use client";

import { useActionState, useState } from "react";
import { checkoutAction, type CheckoutState } from "@/app/(storefront)/checkout/actions";
import { useStorePreferences } from "@/components/storefront/store-preferences";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { EMIRATES, type Address } from "@/lib/address";

const initialState: CheckoutState = null;

export type CheckoutDefaults = {
  email: string;
  fullName: string;
  phone: string;
  shipping: Address | null;
  billing: Address | null;
  signedIn: boolean;
};

export type CheckoutQuote = {
  shippingMinor: number;
  totalMinor: number;
  taxMinor: number;
};

export type CheckoutLineView = {
  itemId: string;
  title: string;
  meta: string;
  lineTotalMinor: number;
};

export function CheckoutForm({
  quotes,
  subtotalMinor,
  lineItems,
  defaults,
}: {
  quotes: Record<string, CheckoutQuote>;
  subtotalMinor: number;
  lineItems: CheckoutLineView[];
  defaults: CheckoutDefaults;
}) {
  const [state, formAction, pending] = useActionState(checkoutAction, initialState);
  const { t, money } = useStorePreferences();
  const [billingSame, setBillingSame] = useState(true);
  const [saveShipping, setSaveShipping] = useState(defaults.signedIn);
  const [saveBilling, setSaveBilling] = useState(defaults.signedIn);
  const [emirate, setEmirate] = useState<string>(defaults.shipping?.emirate ?? "Dubai");

  const shipping = defaults.shipping;
  const billing = defaults.billing ?? defaults.shipping;
  const quote = quotes[emirate] ??
    quotes.Dubai ?? { shippingMinor: 0, totalMinor: subtotalMinor, taxMinor: 0 };

  return (
    <form action={formAction} className="mt-8 grid gap-10 lg:grid-cols-[1fr_340px]">
      <input type="hidden" name="expectedTotalMinor" value={quote.totalMinor} />

      <div className="space-y-6">

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">{t("checkout.contact")}</h2>
        <div>
          <Label htmlFor="email">{t("checkout.email")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            defaultValue={defaults.email}
          />
          <p className="mt-1.5 text-xs text-muted">{t("checkout.emailHelp")}</p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">{t("checkout.deliveryAddress")}</h2>

        <div>
          <Label htmlFor="fullName">{t("checkout.fullName")}</Label>
          <Input
            id="fullName"
            name="fullName"
            required
            autoComplete="name"
            defaultValue={shipping?.fullName ?? defaults.fullName}
          />
        </div>

        <div>
          <Label htmlFor="phone">{t("checkout.mobile")}</Label>
          <Input
            id="phone"
            name="phone"
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="+971501234567"
            pattern="\+971\d{9}"
            title="+971 followed by 9 digits"
            defaultValue={shipping?.phone ?? defaults.phone}
          />
        </div>

        <div>
          <Label htmlFor="emirate">{t("checkout.emirate")}</Label>
          <select
            id="emirate"
            name="emirate"
            required
            value={emirate}
            onChange={(event) => setEmirate(event.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand/30"
          >
            {EMIRATES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-muted">
            {quote.shippingMinor === 0
              ? t("checkout.free")
              : `${t("checkout.delivery")} · ${money(quote.shippingMinor)}`}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="building">{t("checkout.building")}</Label>
            <Input
              id="building"
              name="building"
              required
              autoComplete="address-line1"
              defaultValue={shipping?.building ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="street">{t("checkout.street")}</Label>
            <Input
              id="street"
              name="street"
              required
              autoComplete="address-line2"
              defaultValue={shipping?.street ?? ""}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="area">{t("checkout.area")}</Label>
            <Input
              id="area"
              name="area"
              autoComplete="address-level3"
              placeholder="Jumeirah Lakes Towers"
              defaultValue={shipping?.area ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="poBox">{t("checkout.poBox")}</Label>
            <Input id="poBox" name="poBox" inputMode="numeric" defaultValue={shipping?.poBox ?? ""} />
          </div>
        </div>

        <div>
          <Label htmlFor="notes">{t("checkout.notes")}</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder={t("checkout.notesPlaceholder")}
            defaultValue={shipping?.notes ?? ""}
          />
        </div>

        {defaults.signedIn ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="saveShippingAddress"
              checked={saveShipping}
              onChange={(event) => setSaveShipping(event.target.checked)}
              className="size-4"
            />
            {t("checkout.saveShipping")}
          </label>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">{t("checkout.billingAddress")}</h2>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="billingSameAsDelivery"
            checked={billingSame}
            onChange={(event) => setBillingSame(event.target.checked)}
            className="size-4"
          />
          {t("checkout.sameAsDelivery")}
        </label>

        {billingSame ? null : (
          <div className="space-y-4 rounded-xl border border-line bg-page/60 p-4">
            <div>
              <Label htmlFor="billingFullName">{t("checkout.fullName")}</Label>
              <Input
                id="billingFullName"
                name="billingFullName"
                required
                autoComplete="billing name"
                defaultValue={billing?.fullName ?? defaults.fullName}
              />
            </div>

            <div>
              <Label htmlFor="billingPhone">{t("checkout.mobile")}</Label>
              <Input
                id="billingPhone"
                name="billingPhone"
                required
                inputMode="tel"
                autoComplete="billing tel"
                placeholder="+971501234567"
                pattern="\+971\d{9}"
                title="+971 followed by 9 digits"
                defaultValue={billing?.phone ?? defaults.phone}
              />
            </div>

            <div>
              <Label htmlFor="billingEmirate">{t("checkout.emirate")}</Label>
              <select
                id="billingEmirate"
                name="billingEmirate"
                required
                defaultValue={billing?.emirate ?? "Dubai"}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand/30"
              >
                {EMIRATES.map((emirate) => (
                  <option key={emirate} value={emirate}>
                    {emirate}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="billingBuilding">{t("checkout.building")}</Label>
                <Input
                  id="billingBuilding"
                  name="billingBuilding"
                  required
                  autoComplete="billing address-line1"
                  defaultValue={billing?.building ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="billingStreet">{t("checkout.street")}</Label>
                <Input
                  id="billingStreet"
                  name="billingStreet"
                  required
                  autoComplete="billing address-line2"
                  defaultValue={billing?.street ?? ""}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="billingArea">{t("checkout.area")}</Label>
                <Input
                  id="billingArea"
                  name="billingArea"
                  autoComplete="billing address-level3"
                  defaultValue={billing?.area ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="billingPoBox">{t("checkout.poBox")}</Label>
                <Input
                  id="billingPoBox"
                  name="billingPoBox"
                  inputMode="numeric"
                  defaultValue={billing?.poBox ?? ""}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="billingNotes">{t("checkout.notes")}</Label>
              <Textarea
                id="billingNotes"
                name="billingNotes"
                rows={2}
                defaultValue={billing?.notes ?? ""}
              />
            </div>

            {defaults.signedIn ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="saveBillingAddress"
                  checked={saveBilling}
                  onChange={(event) => setSaveBilling(event.target.checked)}
                  className="size-4"
                />
                {t("checkout.saveBilling")}
              </label>
            ) : null}
          </div>
        )}
      </section>

      {state?.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

        <Button type="submit" disabled={pending} className="w-full" data-testid="place-order">
          {pending ? t("checkout.saving") : `${t("checkout.placeOrder")} · ${money(quote.totalMinor)}`}
        </Button>

        <p className="text-center text-xs text-muted">{t("checkout.paymentHelp")}</p>
      </div>

      <aside className="h-fit rounded-xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">{t("checkout.yourOrder")}</h2>

        <ul className="mt-4 space-y-3 text-sm">
          {lineItems.map((line) => (
            <li key={line.itemId} className="flex justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate">{line.title}</span>
                <span className="text-xs text-muted">{line.meta}</span>
              </span>
              <span className="shrink-0 tabular-nums">{money(line.lineTotalMinor)}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">{t("checkout.subtotal")}</dt>
            <dd className="tabular-nums">{money(subtotalMinor)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">{t("checkout.delivery")}</dt>
            <dd className="tabular-nums">
              {quote.shippingMinor === 0 ? t("checkout.free") : money(quote.shippingMinor)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-line pt-3 text-base font-semibold">
            <dt>{t("checkout.total")}</dt>
            <dd className="tabular-nums">{money(quote.totalMinor)}</dd>
          </div>
        </dl>

        <p className="mt-2 text-xs text-muted">
          {t("checkout.includesVat", { amount: money(quote.taxMinor) })}
        </p>
      </aside>
    </form>
  );
}
