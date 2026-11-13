"use client";

import { useActionState } from "react";
import {
  deleteAccountAction,
  type DeleteAccountState,
} from "@/app/(storefront)/account/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

const initialState: DeleteAccountState = null;

export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState(deleteAccountAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="password">Current password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>

      <div>
        <Label htmlFor="confirmation">Type DELETE to confirm</Label>
        <Input id="confirmation" name="confirmation" required autoComplete="off" />
      </div>

      {state?.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? "Deleting…" : "Delete my account"}
      </Button>
    </form>
  );
}
