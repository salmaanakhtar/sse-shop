import Link from "next/link";
import { ThemeSwitcher } from "@/components/storefront/theme-switcher";
import type { ThemePreference } from "@/lib/theme";
import { getAuthSession } from "@/server/auth/guard";
import { getCartItemCount } from "@/server/services/cart";
import { listCategoryTree } from "@/server/services/categories";
import { getStoreSettings } from "@/server/services/settings";

export async function SiteHeader({ theme }: { theme: ThemePreference }) {
  const [cartCount, settings, session, categories] = await Promise.all([
    getCartItemCount(),
    getStoreSettings(),
    getAuthSession(),
    listCategoryTree(),
  ]);

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="text-base font-semibold tracking-tight">
          {settings.name}
        </Link>

        <nav className="flex items-center gap-5 text-sm">
          <ThemeSwitcher value={theme} />
          <Link
            href={session ? "/account" : "/account/sign-in"}
            className="text-muted transition-colors hover:text-ink"
          >
            {session ? "Account" : "Sign in"}
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

      <div className="border-t border-line/70">
        <nav
          aria-label="Categories"
          className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-6 py-2.5 text-sm"
        >
          <Link href="/" className="text-muted transition-colors hover:text-ink">
            All products
          </Link>

          {categories.map((category) => (
            <div key={category.id} className="group relative">
              <Link
                href={`/category/${category.slug}`}
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
                        href={`/category/${child.slug}`}
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
