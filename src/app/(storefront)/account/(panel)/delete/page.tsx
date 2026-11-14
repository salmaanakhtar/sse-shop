import Link from "next/link";
import { DeleteAccountForm } from "@/components/storefront/delete-account-form";
import { localePath, translate } from "@/lib/i18n";
import { requireUserPage } from "@/server/auth/guard";
import { getLocale } from "@/server/services/preferences";

export const metadata = { title: "Delete account" };

export default async function DeleteAccountPage() {
  const session = await requireUserPage();
  const locale = await getLocale();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          {translate(locale, "delete.heading")}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {translate(locale, "delete.body", { email: session.user.email })}
        </p>
      </div>

      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <DeleteAccountForm />
      </div>

      <Link
        href={localePath(locale, "/account")}
        className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        {translate(locale, "delete.keep")}
      </Link>
    </div>
  );
}
