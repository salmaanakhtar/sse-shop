"use client";

import { useActionState, useState } from "react";
import { checkoutAction, type CheckoutState } from "@/app/(storefront)/checkout/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { EMIRATES, type Address } from "@/lib/address";
import { formatMoney } from "@/lib/money";

const initialState: CheckoutState = null;

export type CheckoutDefaults = {
  email: string;
  fullName: string;
  phone: string;
  shipping: Address | null;
  billing: Address | null;
  signedIn: boolean;
};

export function CheckoutForm({
  expectedTotalMinor,
  defaults,
}: {
  expectedTotalMinor: number;
  defaults: CheckoutDefaults;
}) {
  const [state, formAction, pending] = useActionState(checkoutAction, initialState);
  const [billingSame, setBillingSame] = useState(true);
  const [saveShipping, setSaveShipping] = useState(defaults.signedIn);
  const [saveBilling, setSaveBilling] = useState(defaults.signedIn);

  const shipping = defaults.shipping;
  const billing = defaults.billing ?? defaults.shipping;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="expectedTotalMinor" value={expectedTotalMinor} />

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Contact</h2>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            defaultValue={defaults.email}
          />
          <p className="mt-1.5 text-xs text-muted">
            We send the order confirmation and tracking link here.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Delivery address</h2>

        <div>
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            name="fullName"
            required
            autoComplete="name"
            defaultValue={shipping?.fullName ?? defaults.fullName}
          />
        </div>

        <div>
          <Label htmlFor="phone">Mobile</Label>
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
          <Label htmlFor="emirate">Emirate</Label>
          <select
            id="emirate"
            name="emirate"
            required
            defaultValue={shipping?.emirate ?? "Dubai"}
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
            <Label htmlFor="building">Building or villa</Label>
            <Input
              id="building"
              name="building"
              required
              autoComplete="address-line1"
              defaultValue={shipping?.building ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="street">Street</Label>
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
            <Label htmlFor="area">Area or community (optional)</Label>
            <Input
              id="area"
              name="area"
              autoComplete="address-level3"
              placeholder="Jumeirah Lakes Towers"
              defaultValue={shipping?.area ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="poBox">PO Box (optional)</Label>
            <Input id="poBox" name="poBox" inputMode="numeric" defaultValue={shipping?.poBox ?? ""} />
          </div>
        </div>

        <div>
          <Label htmlFor="notes">Delivery notes (optional)</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder="Gate code, landmark, preferred time"
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
            Save this delivery address to my account
          </label>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Billing address</h2>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="billingSameAsDelivery"
            checked={billingSame}
            onChange={(event) => setBillingSame(event.target.checked)}
            className="size-4"
          />
          Same as delivery address
        </label>

        {billingSame ? null : (
          <div className="space-y-4 rounded-xl border border-line bg-page/60 p-4">
            <div>
              <Label htmlFor="billingFullName">Full name</Label>
              <Input
                id="billingFullName"
                name="billingFullName"
                required
                autoComplete="billing name"
                defaultValue={billing?.fullName ?? defaults.fullName}
              />
            </div>

            <div>
              <Label htmlFor="billingPhone">Mobile</Label>
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
              <Label htmlFor="billingEmirate">Emirate</Label>
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
                <Label htmlFor="billingBuilding">Building or villa</Label>
                <Input
                  id="billingBuilding"
                  name="billingBuilding"
                  required
                  autoComplete="billing address-line1"
                  defaultValue={billing?.building ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="billingStreet">Street</Label>
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
                <Label htmlFor="billingArea">Area or community (optional)</Label>
                <Input
                  id="billingArea"
                  name="billingArea"
                  autoComplete="billing address-level3"
                  defaultValue={billing?.area ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="billingPoBox">PO Box (optional)</Label>
                <Input
                  id="billingPoBox"
                  name="billingPoBox"
                  inputMode="numeric"
                  defaultValue={billing?.poBox ?? ""}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="billingNotes">Notes (optional)</Label>
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
                Save this billing address to my account
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
        {pending ? "Placing order…" : `Place order · ${formatMoney(expectedTotalMinor)}`}
      </Button>

      <p className="text-center text-xs text-muted">
        Payment is simulated in this build; no card details are collected.
      </p>
    </form>
  );
}
