"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

export function TwoFactorForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const code = String(form.get("code") ?? "").trim();

    const result = useBackupCode
      ? await authClient.twoFactor.verifyBackupCode({ code })
      : await authClient.twoFactor.verifyTotp({ code });

    setPending(false);

    if (result.error) {
      setError(result.error.message ?? "That code did not work.");
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="code">{useBackupCode ? "Backup code" : "6-digit code"}</Label>
        <Input
          id="code"
          name="code"
          required
          autoFocus
          inputMode={useBackupCode ? "text" : "numeric"}
          autoComplete="one-time-code"
          placeholder={useBackupCode ? "XXXX-XXXX" : "000000"}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Verifying…" : "Verify"}
      </Button>

      <button
        type="button"
        onClick={() => {
          setUseBackupCode((current) => !current);
          setError(null);
        }}
        className="w-full text-xs text-muted underline-offset-4 hover:underline"
      >
        {useBackupCode ? "Use an authenticator code instead" : "Use a backup code"}
      </button>
    </form>
  );
}
