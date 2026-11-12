"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

type Step = "password" | "verify";

export function SetupTwoFactorForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("password");
  const [secret, setSecret] = useState("");
  const [uri, setUri] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function startSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const result = await authClient.twoFactor.enable({
      password: String(form.get("password") ?? ""),
    });

    setPending(false);

    if (result.error) {
      setError(result.error.message ?? "Could not start setup.");
      return;
    }

    const data = result.data as { totpURI: string; backupCodes: string[] } | null;
    if (!data) {
      setError("Could not start setup.");
      return;
    }

    setUri(data.totpURI);
    setBackupCodes(data.backupCodes ?? []);
    try {
      setSecret(new URL(data.totpURI).searchParams.get("secret") ?? "");
    } catch {
      setSecret("");
    }
    setStep("verify");
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const result = await authClient.twoFactor.verifyTotp({
      code: String(form.get("code") ?? "").trim(),
    });

    setPending(false);

    if (result.error) {
      setError(result.error.message ?? "That code did not work.");
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  if (step === "password") {
    return (
      <form onSubmit={startSetup} className="space-y-4">
        <p className="text-sm text-muted">
          Two-step verification is required for admin access. Confirm your password to generate a
          secret.
        </p>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Preparing…" : "Start setup"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={confirm} className="space-y-5">
      <div className="rounded-lg border border-line bg-page p-4">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">
          Add to your authenticator
        </p>
        <p className="mt-2 text-sm">
          Enter this key manually in Google Authenticator, 1Password, or any TOTP app.
        </p>
        <code className="mt-3 block break-all rounded-md bg-surface px-3 py-2 font-mono text-sm">
          {secret || uri}
        </code>
      </div>

      {backupCodes.length > 0 ? (
        <div className="rounded-lg border border-line bg-page p-4">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Backup codes</p>
          <p className="mt-2 text-xs text-muted">
            Save these now. They are shown once and are the only way in if you lose the device.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-1 font-mono text-xs">
            {backupCodes.map((code) => (
              <span key={code}>{code}</span>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <Label htmlFor="code">Code from the app</Label>
        <Input
          id="code"
          name="code"
          required
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Verifying…" : "Turn on two-step verification"}
      </Button>
    </form>
  );
}
