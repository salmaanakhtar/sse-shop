import Link from "next/link";
import { ClaimOrderForm } from "@/components/storefront/claim-order-form";
import { localePath, translate } from "@/lib/i18n";
import { requireUserPage } from "@/server/auth/guard";
import { getLocale } from "@/server/services/preferences";

export const metadata = { title: "Claim an order" };

export default async function ClaimOrderPage() {
  await requireUserPage();
  const locale = await getLocale();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          {translate(locale, "claim.title")}
        </h2>
        <p className="mt-2 text-sm text-muted">{translate(locale, "claim.body")}</p>
      </div>

      <div className="rounded-xl border border-line bg-surface p-6">
        <ClaimOrderForm />
      </div>

      <Link
        href={localePath(locale, "/account/orders")}
        className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        {translate(locale, "order.all")}
      </Link>
    </div>
  );
}
