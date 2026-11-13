import Link from "next/link";
import { DeleteAccountForm } from "@/components/storefront/delete-account-form";
import { requireUserPage } from "@/server/auth/guard";

export const metadata = { title: "Delete account" };

export default async function DeleteAccountPage() {
  const session = await requireUserPage();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Delete your account</h2>
        <p className="mt-2 text-sm text-muted">
          This permanently removes your profile, saved addresses, and sign-in for{" "}
          <span className="text-ink">{session.user.email}</span>. Orders stay with the store for
          accounting, but you will not be able to sign in again.
        </p>
      </div>

      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <DeleteAccountForm />
      </div>

      <Link
        href="/account"
        className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        Keep my account
      </Link>
    </div>
  );
}
