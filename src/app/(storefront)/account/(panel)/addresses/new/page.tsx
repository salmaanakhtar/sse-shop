import Link from "next/link";
import { createAddressAction } from "@/app/(storefront)/account/addresses/actions";
import { AddressForm } from "@/components/storefront/address-form";
import { requireUserPage } from "@/server/auth/guard";

export const metadata = { title: "Add an address" };

export default async function NewAddressPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireUserPage();
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Add an address</h2>
        <p className="mt-2 text-sm text-muted">
          The first address becomes your default for delivery and billing.
        </p>
      </div>

      <AddressForm
        action={createAddressAction}
        submitLabel="Save address"
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
