import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountSignInForm } from "@/components/storefront/account-sign-in-form";
import { localePath, translate } from "@/lib/i18n";
import { getAuthSession } from "@/server/auth/guard";
import { getLocale } from "@/server/services/preferences";

export const metadata = { title: "Sign in" };

export default async function AccountSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; deleted?: string }>;
}) {
  const [session, locale] = await Promise.all([getAuthSession(), getLocale()]);
  if (session) redirect(localePath(locale, "/account"));

  const { next, deleted } = await searchParams;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-xl border border-line bg-surface p-6">
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
          {translate(locale, "nav.account")}
        </p>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">
          {translate(locale, "auth.signIn")}
        </h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          {translate(locale, "auth.signInBody")}
        </p>

        {deleted ? (
          <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Your account has been deleted.
          </p>
        ) : null}

        <AccountSignInForm next={next} />
      </div>

      <Link
        href={localePath(locale, "/")}
        className="mt-6 text-center text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        {translate(locale, "auth.continueShopping")}
      </Link>
    </div>
  );
}
