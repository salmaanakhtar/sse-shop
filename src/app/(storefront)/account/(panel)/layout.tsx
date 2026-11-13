import Link from "next/link";
import type { ReactNode } from "react";
import { signOutCustomerAction } from "@/app/(storefront)/account/actions";
import { requireUserPage } from "@/server/auth/guard";

export const metadata = { title: "Account" };

const nav = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/wishlists", label: "Wishlist" },
  { href: "/account/addresses", label: "Addresses" },
];

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const session = await requireUserPage();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">Account</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{session.user.name}</h1>
          <p className="mt-1 text-sm text-muted">{session.user.email}</p>
        </div>

        <form action={signOutCustomerAction}>
          <button
            type="submit"
            className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Sign out
          </button>
        </form>
      </div>

      <nav className="mt-6 flex flex-wrap gap-5 border-b border-line pb-3 text-sm">
        {nav.map((item) => (
          <Link key={item.href} href={item.href} className="text-muted hover:text-ink">
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-8">{children}</div>
    </div>
  );
}
