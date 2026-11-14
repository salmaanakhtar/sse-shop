import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import {
  AnnouncementBar,
  SiteFooter,
  SiteHeader,
} from "@/components/storefront/site-header";
import { StorePreferencesProvider } from "@/components/storefront/store-preferences";
import {
  getLocale,
  getNumeralPreference,
  getStorePath,
  getThemePreference,
} from "@/server/services/preferences";
import { listPages } from "@/server/services/pages";
import { getStoreSettings } from "@/server/services/settings";

// Every storefront page renders a cart-aware header, so nothing here can be
// prerendered at build time. A build must never need a database.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  const base = new URL(process.env.NEXT_PUBLIC_STORE_URL ?? "http://localhost:3000");
  return {
    metadataBase: base,
    title: {
      default: settings.name,
      template: `%s · ${settings.name}`,
    },
    description: "Considered goods, delivered across the UAE. Prices include VAT.",
    alternates: {
      canonical: base,
      languages: {
        en: base.toString(),
        ar: new URL("/ar", base).toString(),
      },
    },
    openGraph: {
      type: "website",
      siteName: settings.name,
      title: settings.name,
      description: "Considered goods, delivered across the UAE.",
    },
  };
}

export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  const [settings, theme, pages, locale, numerals, pathname] = await Promise.all([
    getStoreSettings(),
    getThemePreference(),
    listPages(true),
    getLocale(),
    getNumeralPreference(),
    getStorePath(),
  ]);

  const themeStyle = {
    "--color-brand": settings.themeBrand,
    "--color-brand-soft": settings.themeBrandSoft,
    "--radius-md": settings.themeRadius,
    "--radius-lg": settings.themeRadius,
    "--radius-xl": settings.themeRadius,
    "--radius-2xl": settings.themeRadius,
  } as CSSProperties;

  return (
    <div
      id="storefront"
      dir={locale === "ar" ? "rtl" : "ltr"}
      lang={locale}
      data-theme={theme}
      style={themeStyle}
      className="storefront-shell flex min-h-screen flex-col bg-page text-ink"
    >
      <StorePreferencesProvider locale={locale} numerals={numerals}>
        <AnnouncementBar settings={settings} />
        <SiteHeader
          theme={theme}
          locale={locale}
          numerals={numerals}
          pathname={pathname}
        />
        <main className="flex-1">{children}</main>
        <SiteFooter settings={settings} pages={pages} locale={locale} numerals={numerals} />
      </StorePreferencesProvider>
    </div>
  );
}
