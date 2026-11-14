import Link from "next/link";
import { deleteAddressAction } from "@/app/(storefront)/account/addresses/actions";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { buttonClass } from "@/components/ui/button";
import { formatAddress } from "@/lib/address";
import { localePath, translate } from "@/lib/i18n";
import { requireUserPage } from "@/server/auth/guard";
import { listAddresses } from "@/server/services/addresses";
import { getLocale } from "@/server/services/preferences";

export const metadata = { title: "Saved addresses" };

export default async function AccountAddressesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireUserPage();
  const [{ error }, addresses, locale] = await Promise.all([
    searchParams,
    listAddresses(session.user.id),
    getLocale(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">
          {translate(locale, "addresses.title")}
        </h2>
        <Link
          href={localePath(locale, "/account/addresses/new")}
          className={buttonClass("primary", "sm")}
        >
          {translate(locale, "addresses.add")}
        </Link>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {addresses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center">
          <p className="text-sm text-muted">{translate(locale, "addresses.empty")}</p>
          <Link
            href={localePath(locale, "/account/addresses/new")}
            className={buttonClass("primary", "sm", "mt-4")}
          >
            {translate(locale, "addresses.addFirst")}
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <article key={address.id} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">
                    {address.label || translate(locale, "addresses.address")}
                  </h3>
                  <div className="mt-2 space-y-0.5 text-sm text-muted">
                    {formatAddress(address).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-[10px] font-semibold tracking-wide uppercase">
                  {address.isDefaultShipping ? (
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-brand">
                      {translate(locale, "addresses.deliveryDefault")}
                    </span>
                  ) : null}
                  {address.isDefaultBilling ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                      {translate(locale, "addresses.billingDefault")}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-4 border-t border-line pt-3 text-xs">
                <Link
                  href={localePath(locale, `/account/addresses/${address.id}/edit`)}
                  className="text-muted underline-offset-4 hover:text-ink hover:underline"
                >
                  {translate(locale, "addresses.edit")}
                </Link>
                <form action={deleteAddressAction}>
                  <input type="hidden" name="id" value={address.id} />
                  <ConfirmSubmitButton
                    type="submit"
                    message={translate(locale, "addresses.deleteConfirm")}
                    className="text-muted underline-offset-4 hover:text-red-600 hover:underline"
                  >
                    {translate(locale, "addresses.delete")}
                  </ConfirmSubmitButton>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
