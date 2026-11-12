import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/storefront/site-header";
import { getStoreSettings } from "@/server/services/settings";

export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  const settings = await getStoreSettings();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter storeName={settings.name} />
    </div>
  );
}
