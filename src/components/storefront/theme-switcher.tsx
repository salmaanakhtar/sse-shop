"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setThemePreferenceAction } from "@/app/(storefront)/preferences-actions";
import type { ThemePreference } from "@/lib/theme";

const LABEL: Record<ThemePreference, string> = {
  system: "Auto",
  light: "Light",
  dark: "Dark",
};

export function ThemeSwitcher({ value }: { value: ThemePreference }) {
  const router = useRouter();
  const [current, setCurrent] = useState<ThemePreference>(value);
  const [pending, startTransition] = useTransition();

  function change(next: ThemePreference) {
    setCurrent(next);
    document.getElementById("storefront")?.setAttribute("data-theme", next);

    startTransition(async () => {
      await setThemePreferenceAction(next);
      router.refresh();
    });
  }

  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className="sr-only">Theme</span>
      <select
        aria-label="Theme"
        value={current}
        disabled={pending}
        onChange={(event) => change(event.target.value as ThemePreference)}
        className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-muted hover:text-ink focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand/30 disabled:opacity-60"
      >
        {(["system", "light", "dark"] as const).map((theme) => (
          <option key={theme} value={theme}>
            {LABEL[theme]}
          </option>
        ))}
      </select>
    </label>
  );
}
