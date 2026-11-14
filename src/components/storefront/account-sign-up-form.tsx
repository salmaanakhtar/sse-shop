"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { mergeCartAfterSignInAction } from "@/app/(storefront)/account/actions";
import { useStorePreferences } from "@/components/storefront/store-preferences";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { localePath } from "@/lib/i18n";

function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
    ? next
    : "/account";
}

export function AccountSignUpForm({ next }: { next?: string }) {
  const router = useRouter();
  const { t, locale } = useStorePreferences();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const target = safeNext(next);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setPending(false);
      setError(t("auth.passwordMismatch"));
      return;
    }

    const phone = String(form.get("phone") ?? "").trim();

    const result = await authClient.signUp.email({
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password,
      phone: phone || undefined,
    });

    if (result.error) {
      setPending(false);
      setError(result.error.message ?? t("auth.createFailed"));
      return;
    }

    try {
      await mergeCartAfterSignInAction();
    } catch (mergeError) {
      // The account exists; a cart merge failure must not strand the shopper.
      console.error("cart merge after sign-up failed", mergeError);
    }
    router.replace(localePath(locale, target));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">{t("auth.name")}</Label>
        <Input id="name" name="name" required autoComplete="name" maxLength={120} />
      </div>

      <div>
        <Label htmlFor="email">{t("auth.email")}</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>

      <div>
        <Label htmlFor="phone">{t("auth.mobileOptional")}</Label>
        <Input
          id="phone"
          name="phone"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+971501234567"
          pattern="\+971\d{9}"
          title="+971 followed by 9 digits"
        />
      </div>

      <div>
        <Label htmlFor="password">{t("auth.password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
        />
        <p className="mt-1.5 text-xs text-muted">{t("auth.passwordHelp")}</p>
      </div>

      <div>
        <Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t("auth.creating") : t("auth.createSubmit")}
      </Button>

      <p className="text-center text-xs text-muted">
        {t("auth.alreadyHave")}{" "}
        <Link
          href={`${localePath(locale, "/account/sign-in")}${target !== "/account" ? `?next=${encodeURIComponent(target)}` : ""}`}
          className="underline underline-offset-4 hover:text-ink"
        >
          {t("auth.signIn")}
        </Link>
      </p>

      <p className="text-center text-xs text-muted">{t("auth.verifyNote")}</p>
    </form>
  );
}
