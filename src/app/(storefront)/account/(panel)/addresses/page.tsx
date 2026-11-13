import Link from "next/link";
import { deleteAddressAction } from "@/app/(storefront)/account/addresses/actions";
import { ConfirmSubmitButton } from "@/components/storefront/confirm-submit-button";
import { buttonClass } from "@/components/ui/button";
import { formatAddress } from "@/lib/address";
import { requireUserPage } from "@/server/auth/guard";
import { listAddresses } from "@/server/services/addresses";

export const metadata = { title: "Saved addresses" };

export default async function AccountAddressesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireUserPage();
  const [{ error }, addresses] = await Promise.all([
    searchParams,
    listAddresses(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Addresses</h2>
        <Link href="/account/addresses/new" className={buttonClass("primary", "sm")}>
          Add address
        </Link>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {addresses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center">
          <p className="text-sm text-muted">No saved addresses yet.</p>
          <Link href="/account/addresses/new" className={buttonClass("primary", "sm", "mt-4")}>
            Add the first one
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <article key={address.id} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">{address.label || "Address"}</h3>
                  <div className="mt-2 space-y-0.5 text-sm text-muted">
                    {formatAddress(address).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-[10px] font-semibold tracking-wide uppercase">
                  {address.isDefaultShipping ? (
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-brand">
                      Delivery default
                    </span>
                  ) : null}
                  {address.isDefaultBilling ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                      Billing default
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-4 border-t border-line pt-3 text-xs">
                <Link
                  href={`/account/addresses/${address.id}/edit`}
                  className="text-muted underline-offset-4 hover:text-ink hover:underline"
                >
                  Edit
                </Link>
                <form action={deleteAddressAction}>
                  <input type="hidden" name="id" value={address.id} />
                  <ConfirmSubmitButton
                    type="submit"
                    message="Delete this saved address?"
                    className="text-muted underline-offset-4 hover:text-red-600 hover:underline"
                  >
                    Delete
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
