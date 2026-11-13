import Link from "next/link";
import { ClaimOrderForm } from "@/components/storefront/claim-order-form";
import { requireUserPage } from "@/server/auth/guard";

export const metadata = { title: "Claim an order" };

export default async function ClaimOrderPage() {
  await requireUserPage();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Claim a guest order</h2>
        <p className="mt-2 text-sm text-muted">
          If you checked out before creating an account, add that order with the order number and
          the lookup token from your confirmation link.
        </p>
      </div>

      <div className="rounded-xl border border-line bg-surface p-6">
        <ClaimOrderForm />
      </div>

      <Link
        href="/account/orders"
        className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        Back to orders
      </Link>
    </div>
  );
}
