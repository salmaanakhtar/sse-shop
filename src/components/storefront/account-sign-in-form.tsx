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

export function AccountSignInForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const target = safeNext(next);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const result = await authClient.signIn.email({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });

    if (result.error) {
      setPending(false);
      setError(result.error.message ?? "Sign-in failed.");
      return;
    }

    const needsSecondFactor = (result.data as { twoFactorRedirect?: boolean } | null)
      ?.twoFactorRedirect;
    if (needsSecondFactor) {
      setPending(false);
      setError("This account needs two-step verification. Sign in on the admin host.");
      return;
    }

    try {
      await mergeCartAfterSignInAction();
    } catch (mergeError) {
      // Sign-in succeeded; a cart merge failure must not strand the shopper.
      console.error("cart merge after sign-in failed", mergeError);
    }
    router.replace(target);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-xs text-muted">
        New here?{" "}
        <Link
          href={`/account/sign-up${target !== "/account" ? `?next=${encodeURIComponent(target)}` : ""}`}
          className="underline underline-offset-4 hover:text-ink"
        >
          Create an account
        </Link>
      </p>

      <p className="text-center text-xs text-muted">
        Password reset is not available yet. Contact the store if you are locked out.
      </p>
    </form>
  );
}
