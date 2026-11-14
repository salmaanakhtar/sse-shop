"use client";

import { useActionState } from "react";
import {
  updateProfileAction,
  type ProfileState,
} from "@/app/(storefront)/account/actions";
import { useStorePreferences } from "@/components/storefront/store-preferences";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

const initialState: ProfileState = null;

export function ProfileForm({
  name,
  email,
  phone,
}: {
  name: string;
  email: string;
  phone: string;
}) {
  const { t } = useStorePreferences();
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="name">{t("profile.name")}</Label>
        <Input id="name" name="name" required defaultValue={name} maxLength={120} />
      </div>

      <div>
        <Label htmlFor="email">{t("profile.email")}</Label>
        <Input id="email" defaultValue={email} disabled />
        <p className="mt-1.5 text-xs text-muted">{t("profile.emailHelp")}</p>
      </div>

      <div>
        <Label htmlFor="phone">{t("profile.phone")}</Label>
        <Input
          id="phone"
          name="phone"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+971501234567"
          pattern="\+971\d{9}"
          title="+971 followed by 9 digits"
          defaultValue={phone}
        />
      </div>

      {state?.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p role="status" className="text-sm text-emerald-700">
          {state.success}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} size="sm">
        {pending ? t("profile.saving") : t("profile.save")}
      </Button>
    </form>
  );
}
