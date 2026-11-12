import Link from "next/link";
import { getCartItemCount } from "@/server/services/cart";
import { getStoreSettings } from "@/server/services/settings";

export async function SiteHeader() {
  const [cartCount, settings] = await Promise.all([getCartItemCount(), getStoreSettings()]);

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="text-base font-semibold tracking-tight">
          {settings.name}
        </Link>

        <nav className="flex items-center gap-6 text-sm">
          <Link href="/" className="text-muted transition-colors hover:text-ink">
            Shop
          </Link>
          <Link
            href="/cart"
            className="inline-flex items-center gap-2 text-muted transition-colors hover:text-ink"
          >
            Cart
            {cartCount > 0 ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-semibold text-white">
                {cartCount}
              </span>
            ) : null}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ storeName }: { storeName: string }) {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-xs text-muted">
        <span>
          {storeName} · Prices include 5% VAT
        </span>
        <span>Free delivery over AED 200</span>
      </div>
    </footer>
  );
}
