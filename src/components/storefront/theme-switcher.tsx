"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setThemePreferenceAction } from "@/app/(storefront)/preferences-actions";
import { useStorePreferences } from "@/components/storefront/store-preferences";
import type { ThemePreference } from "@/lib/theme";

export function ThemeSwitcher({ value }: { value: ThemePreference }) {
  const router = useRouter();
  const { t } = useStorePreferences();
  const [current, setCurrent] = useState<ThemePreference>(value);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const labels: Record<ThemePreference, string> = {
    system: t("theme.system"),
    light: t("theme.light"),
    dark: t("theme.dark"),
  };

  function change(next: ThemePreference) {
    setCurrent(next);
    setSaved(false);
    document.getElementById("storefront")?.setAttribute("data-theme", next);

    startTransition(async () => {
      await setThemePreferenceAction(next);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className="sr-only">{t("theme.label")}</span>
      <select
        aria-label={t("theme.label")}
        value={current}
        disabled={pending}
        onChange={(event) => change(event.target.value as ThemePreference)}
        className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-muted hover:text-ink focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand/30 disabled:opacity-60"
      >
        {(["system", "light", "dark"] as const).map((theme) => (
          <option key={theme} value={theme}>
            {labels[theme]}
          </option>
        ))}
      </select>
      {saved ? (
        <span role="status" data-testid="theme-saved" className="sr-only">
          Theme saved.
        </span>
      ) : null}
    </label>
  );
}
