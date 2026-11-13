import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/storefront/site-header";
import { getThemePreference } from "@/server/services/preferences";
import { getStoreSettings } from "@/server/services/settings";

// Every storefront page renders a cart-aware header, so nothing here can be
// prerendered at build time. A build must never need a database.
export const dynamic = "force-dynamic";

export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  const [settings, theme] = await Promise.all([getStoreSettings(), getThemePreference()]);

  return (
    <div
      id="storefront"
      data-theme={theme}
      className="storefront-shell flex min-h-screen flex-col bg-page text-ink"
    >
      <SiteHeader theme={theme} />
      <main className="flex-1">{children}</main>
      <SiteFooter storeName={settings.name} />
    </div>
  );
}
