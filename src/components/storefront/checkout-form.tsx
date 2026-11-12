"use client";

import { useActionState } from "react";
import { checkoutAction, type CheckoutState } from "@/app/(storefront)/checkout/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { EMIRATES } from "@/lib/address";
import { formatMoney } from "@/lib/money";

const initialState: CheckoutState = null;

export function CheckoutForm({ expectedTotalMinor }: { expectedTotalMinor: number }) {
  const [state, formAction, pending] = useActionState(checkoutAction, initialState);

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
          <Input id="fullName" name="fullName" required autoComplete="name" />
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
          />
        </div>

        <div>
          <Label htmlFor="emirate">Emirate</Label>
          <select
            id="emirate"
            name="emirate"
            required
            defaultValue="Dubai"
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
            <Input id="building" name="building" required autoComplete="address-line1" />
          </div>
          <div>
            <Label htmlFor="street">Street</Label>
            <Input id="street" name="street" required autoComplete="address-line2" />
          </div>
        </div>

        <div>
          <Label htmlFor="poBox">PO Box (optional)</Label>
          <Input id="poBox" name="poBox" inputMode="numeric" />
        </div>

        <div>
          <Label htmlFor="notes">Delivery notes (optional)</Label>
          <Textarea id="notes" name="notes" rows={3} placeholder="Gate code, landmark, preferred time" />
        </div>
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
