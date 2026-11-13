import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "@/server/actions/admin-auth";
import { requireAdminPage } from "@/server/auth/guard";

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/collections", label: "Collections" },
  { href: "/admin/badges", label: "Badges" },
  { href: "/admin/promotions", label: "Promotions" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
];

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const session = await requireAdminPage();

  return (
    <div>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/admin" className="text-sm font-semibold tracking-tight">
            sse-shop admin
          </Link>

          <div className="flex items-center gap-4 text-xs text-muted">
            <span className="hidden sm:inline">{session.user.email}</span>
            <form action={signOutAction}>
              <button type="submit" className="underline-offset-4 hover:text-ink hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </div>

        <nav className="mx-auto max-w-6xl overflow-x-auto px-6">
          <div className="flex gap-5 pb-3 text-sm text-muted">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap transition-colors hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
