import { setLocaleAction, setNumeralsAction } from "@/app/(storefront)/preferences-actions";
import { translate, type Locale, type NumeralStyle } from "@/lib/i18n";

export function LanguageSwitcher({
  locale,
  pathname,
}: {
  locale: Locale;
  pathname: string;
}) {
  const next: Locale = locale === "ar" ? "en" : "ar";
  return (
    <form action={setLocaleAction}>
      <input type="hidden" name="locale" value={next} />
      <input type="hidden" name="next" value={pathname} />
      <button
        type="submit"
        className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-muted hover:text-ink"
      >
        {translate(next, next === "ar" ? "language.arabic" : "language.english")}
      </button>
    </form>
  );
}

export function NumeralSwitcher({
  locale,
  numerals,
  pathname,
}: {
  locale: Locale;
  numerals: NumeralStyle;
  pathname: string;
}) {
  if (locale !== "ar") return null;

  return (
    <form action={setNumeralsAction} className="inline-flex items-center gap-1">
      <input type="hidden" name="next" value={pathname} />
      {(["latin", "arabic"] as const).map((style) => (
        <button
          key={style}
          type="submit"
          name="numerals"
          value={style}
          aria-pressed={numerals === style}
          title={translate(locale, style === "latin" ? "numerals.latin" : "numerals.arabic")}
          className={`rounded-md border px-1.5 py-1 text-[11px] ${
            numerals === style
              ? "border-brand bg-brand-soft text-brand"
              : "border-line bg-surface text-muted hover:text-ink"
          }`}
        >
          {style === "latin" ? "012" : "٠١٢"}
        </button>
      ))}
    </form>
  );
}
