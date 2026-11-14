import Link from "next/link";
import {
  LanguageSwitcher,
  NumeralSwitcher,
} from "@/components/storefront/language-switcher";
import { ThemeSwitcher } from "@/components/storefront/theme-switcher";
import { localePath, translate, type Locale, type NumeralStyle } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import type { ThemePreference } from "@/lib/theme";
import { getAuthSession } from "@/server/auth/guard";
import { getCartItemCount } from "@/server/services/cart";
import { listCategoryTree } from "@/server/services/categories";
import type { PageRecord } from "@/server/services/pages";
import { getStoreSettings, type StoreSettings } from "@/server/services/settings";

export function AnnouncementBar({ settings }: { settings: StoreSettings }) {
  if (!settings.announcementActive || !settings.announcementText) return null;

  const content = <span>{settings.announcementText}</span>;

  return (
    <div className="bg-ink px-6 py-2 text-center text-xs font-medium text-white">
      {settings.announcementHref ? (
        <Link href={settings.announcementHref} className="hover:underline">
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}

export async function SiteHeader({
  theme,
  locale,
  numerals,
  pathname,
}: {
  theme: ThemePreference;
  locale: Locale;
  numerals: NumeralStyle;
  pathname: string;
}) {
  const [cartCount, settings, session, categories] = await Promise.all([
    getCartItemCount(),
    getStoreSettings(),
    getAuthSession(),
    listCategoryTree(),
  ]);

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link href={localePath(locale, "/")} className="text-base font-semibold tracking-tight">
          {settings.name}
        </Link>

        <nav className="flex flex-wrap items-center justify-end gap-3 text-sm">
          <LanguageSwitcher locale={locale} pathname={pathname} />
          <NumeralSwitcher locale={locale} numerals={numerals} pathname={pathname} />
          <ThemeSwitcher value={theme} />
          <Link
            href={localePath(locale, session ? "/account" : "/account/sign-in")}
            className="text-muted transition-colors hover:text-ink"
          >
            {session
              ? translate(locale, "nav.account")
              : translate(locale, "nav.signIn")}
          </Link>
          <Link
            href={localePath(locale, "/cart")}
            className="inline-flex items-center gap-2 text-muted transition-colors hover:text-ink"
          >
            {translate(locale, "nav.cart")}
            {cartCount > 0 ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-semibold text-white">
                {cartCount}
              </span>
            ) : null}
          </Link>
        </nav>
      </div>

      <div className="border-t border-line/70">
        <nav
          aria-label={translate(locale, "nav.categories")}
          className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-6 py-2.5 text-sm"
        >
          <form action={localePath(locale, "/search")} method="get" className="flex gap-1.5">
            <input
              name="q"
              type="search"
              placeholder={translate(locale, "common.search")}
              aria-label={translate(locale, "common.search")}
              className="h-8 w-36 rounded-md border border-line bg-surface px-2 text-sm"
            />
            <button
              type="submit"
              className="h-8 rounded-md border border-line bg-surface px-2 text-xs text-muted hover:text-ink"
            >
              {translate(locale, "common.search")}
            </button>
          </form>

          <Link
            href={localePath(locale, "/")}
            className="text-muted transition-colors hover:text-ink"
          >
            {translate(locale, "nav.allProducts")}
          </Link>

          {categories.map((category) => (
            <div key={category.id} className="group relative">
              <Link
                href={localePath(locale, `/category/${category.slug}`)}
                className="inline-flex items-center gap-1 text-muted transition-colors hover:text-ink"
              >
                {category.name}
                {category.children.length > 0 ? (
                  <span aria-hidden className="text-[10px]">
                    ▾
                  </span>
                ) : null}
              </Link>

              {category.children.length > 0 ? (
                <div className="invisible absolute left-0 top-full z-30 w-52 pt-2 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  <div className="rounded-xl border border-line bg-surface p-1.5 shadow-lg">
                    {category.children.map((child) => (
                      <Link
                        key={child.id}
                        href={localePath(locale, `/category/${child.slug}`)}
                        className="block rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-page hover:text-ink"
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({
  settings,
  pages,
  locale,
  numerals,
}: {
  settings: StoreSettings;
  pages: PageRecord[];
  locale: Locale;
  numerals: NumeralStyle;
}) {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto max-w-5xl space-y-4 px-6 py-8 text-xs text-muted">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            {settings.name} ·{" "}
            {translate(
              locale,
              settings.taxInclusive ? "footer.vatIncluded" : "footer.vatAdded",
            )}
          </span>
          <span>
            {settings.shippingFreeThresholdMinor > 0
              ? translate(locale, "footer.freeOver", {
                  amount: formatMoney(settings.shippingFreeThresholdMinor, { locale, numerals }),
                })
              : translate(locale, "footer.free")}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {pages.map((page) => (
            <Link
              key={page.id}
              href={localePath(locale, `/pages/${page.slug}`)}
              className="hover:text-ink"
            >
              {page.title}
            </Link>
          ))}
          {settings.contactEmail ? (
            <a href={`mailto:${settings.contactEmail}`} className="hover:text-ink">
              {translate(locale, "common.contact")}
            </a>
          ) : null}
        </div>

        {settings.address ? <p>{settings.address}</p> : null}
        {settings.trn ? (
          <p>{translate(locale, "footer.trn", { trn: settings.trn })}</p>
        ) : null}
      </div>
    </footer>
  );
}
