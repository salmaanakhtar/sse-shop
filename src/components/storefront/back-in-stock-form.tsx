"use client";

import { useState } from "react";
import { notifyWhenBackInStockAction } from "@/app/(storefront)/stock-actions";
import { useStorePreferences } from "@/components/storefront/store-preferences";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

export function BackInStockForm({ variantId }: { variantId: string }) {
  const { t } = useStorePreferences();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const result = await notifyWhenBackInStockAction({ variantId, email, consent });
    setPending(false);

    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }

    setMessage({
      kind: "ok",
      text: result.data.status === "in_stock" ? t("stock.inStock") : t("stock.done"),
    });
    setEmail("");
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg border border-line p-3">
      <div>
        <p className="text-sm font-medium">{t("stock.title")}</p>
        <p className="mt-0.5 text-xs text-muted">{t("stock.help")}</p>
      </div>

      <div>
        <Label htmlFor={`stock-email-${variantId}`}>{t("stock.email")}</Label>
        <Input
          id={`stock-email-${variantId}`}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <label className="flex items-start gap-2 text-xs text-muted">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 size-4"
        />
        {t("stock.consent")}
      </label>

      {message ? (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`text-xs ${message.kind === "error" ? "text-red-600" : "text-emerald-700"}`}
        >
          {message.text}
        </p>
      ) : null}

      <Button type="submit" size="sm" variant="secondary" disabled={pending || !consent}>
        {pending ? t("stock.sending") : t("stock.submit")}
      </Button>
    </form>
  );
}
