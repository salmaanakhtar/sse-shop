"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { mergeCartAfterSignInAction } from "@/app/(storefront)/account/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
    ? next
    : "/account";
}

export function AccountSignUpForm({ next }: { next?: string }) {
  const router = useRouter();
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
      setError("The passwords do not match.");
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
      setError(result.error.message ?? "Could not create the account.");
      return;
    }

    try {
      await mergeCartAfterSignInAction();
    } catch (mergeError) {
      // The account exists; a cart merge failure must not strand the shopper.
      console.error("cart merge after sign-up failed", mergeError);
    }
    router.replace(target);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required autoComplete="name" maxLength={120} />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>

      <div>
        <Label htmlFor="phone">Mobile (optional)</Label>
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
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
        />
        <p className="mt-1.5 text-xs text-muted">At least 12 characters.</p>
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirm password</Label>
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
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-xs text-muted">
        Already have an account?{" "}
        <Link
          href={`/account/sign-in${target !== "/account" ? `?next=${encodeURIComponent(target)}` : ""}`}
          className="underline underline-offset-4 hover:text-ink"
        >
          Sign in
        </Link>
      </p>

      <p className="text-center text-xs text-muted">
        Email verification is not required yet. Order lookup links still use their own token.
      </p>
    </form>
  );
}
