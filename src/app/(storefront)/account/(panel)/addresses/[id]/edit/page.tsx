import Link from "next/link";
import { notFound } from "next/navigation";
import { updateAddressAction } from "@/app/(storefront)/account/addresses/actions";
import { AddressForm } from "@/components/storefront/address-form";
import { requireUserPage } from "@/server/auth/guard";
import { getAddress } from "@/server/services/addresses";

export const metadata = { title: "Edit address" };

export default async function EditAddressPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireUserPage();
  const [{ id }, { error }] = await Promise.all([params, searchParams]);

  const address = await getAddress(session.user.id, id);
  if (!address) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Edit address</h2>
        <p className="mt-2 text-sm text-muted">
          Changes only affect future checkouts. Past orders keep their original delivery details.
        </p>
      </div>

      <AddressForm
        action={updateAddressAction}
        values={address}
        submitLabel="Save changes"
        error={error}
      />

      <Link
        href="/account/addresses"
        className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        Back to addresses
      </Link>
    </div>
  );
}
