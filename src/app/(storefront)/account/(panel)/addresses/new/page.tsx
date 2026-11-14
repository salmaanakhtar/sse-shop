import Link from "next/link";
import { createAddressAction } from "@/app/(storefront)/account/addresses/actions";
import { AddressForm } from "@/components/storefront/address-form";
import { localePath, translate } from "@/lib/i18n";
import { requireUserPage } from "@/server/auth/guard";
import { getLocale } from "@/server/services/preferences";

export const metadata = { title: "Add an address" };

export default async function NewAddressPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireUserPage();
  const [{ error }, locale] = await Promise.all([searchParams, getLocale()]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          {translate(locale, "addresses.newTitle")}
        </h2>
        <p className="mt-2 text-sm text-muted">{translate(locale, "addresses.newHelp")}</p>
      </div>

      <AddressForm
        action={createAddressAction}
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
