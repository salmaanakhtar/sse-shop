"use client";

import { useActionState } from "react";
import {
  claimOrderAction,
  type ClaimState,
} from "@/app/(storefront)/account/orders/claim/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

const initialState: ClaimState = null;

export function ClaimOrderForm({
  number,
  token,
  compact = false,
}: {
  number?: string;
  token?: string;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(claimOrderAction, initialState);

  return (
    <form action={formAction} className={compact ? "space-y-3" : "space-y-4"}>
      {number && token ? (
        <>
          <input type="hidden" name="number" value={number} />
          <input type="hidden" name="token" value={token} />
        </>
      ) : (
        <>
          <div>
            <Label htmlFor="number">Order number</Label>
            <Input id="number" name="number" required placeholder="SS-2026-000001" />
          </div>
          <div>
            <Label htmlFor="token">Lookup token</Label>
            <Input
              id="token"
              name="token"
              required
              placeholder="The t= value from your order link"
            />
            <p className="mt-1.5 text-xs text-muted">
              It is the long value after <code>?t=</code> in the confirmation link.
            </p>
          </div>
        </>
      )}

      {state?.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} variant={compact ? "secondary" : "primary"}>
        {pending ? "Saving…" : "Save this order to my account"}
      </Button>
    </form>
  );
}
