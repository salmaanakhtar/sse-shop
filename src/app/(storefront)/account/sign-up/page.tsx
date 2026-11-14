import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountSignUpForm } from "@/components/storefront/account-sign-up-form";
import { localePath, translate } from "@/lib/i18n";
import { getAuthSession } from "@/server/auth/guard";
import { getLocale } from "@/server/services/preferences";

export const metadata = { title: "Create an account" };

export default async function AccountSignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [session, locale] = await Promise.all([getAuthSession(), getLocale()]);
  if (session) redirect(localePath(locale, "/account"));

  const { next } = await searchParams;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-xl border border-line bg-surface p-6">
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
          {translate(locale, "nav.account")}
        </p>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">
          {translate(locale, "auth.createAccount")}
        </h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          {translate(locale, "auth.createAccountBody")}
        </p>

        <AccountSignUpForm next={next} />
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
