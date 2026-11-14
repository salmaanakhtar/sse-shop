import Link from "next/link";
import { notFound } from "next/navigation";
import { updateAddressAction } from "@/app/(storefront)/account/addresses/actions";
import { AddressForm } from "@/components/storefront/address-form";
import { localePath, translate } from "@/lib/i18n";
import { requireUserPage } from "@/server/auth/guard";
import { getAddress } from "@/server/services/addresses";
import { getLocale } from "@/server/services/preferences";

export const metadata = { title: "Edit address" };

export default async function EditAddressPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireUserPage();
  const [{ id }, { error }, locale] = await Promise.all([
    params,
    searchParams,
    getLocale(),
  ]);

  const address = await getAddress(session.user.id, id);
  if (!address) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          {translate(locale, "addresses.editTitle")}
        </h2>
        <p className="mt-2 text-sm text-muted">{translate(locale, "addresses.editHelp")}</p>
      </div>

      <AddressForm
        action={updateAddressAction}
        values={address}
        submitLabel={translate(locale, "addresses.save")}
        error={error}
        locale={locale}
      />

      <Link
        href={localePath(locale, "/account/addresses")}
        className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        {translate(locale, "addresses.back")}
      </Link>
    </div>
  );
}
