import Link from "next/link";
import { notFound } from "next/navigation";
import { ClaimOrderForm } from "@/components/storefront/claim-order-form";
import { OrderAftercare } from "@/components/storefront/order-aftercare";
import { OrderDetail, ORDER_STATUS_LABEL } from "@/components/storefront/order-detail";
import { buttonClass } from "@/components/ui/button";
import { getAuthSession } from "@/server/auth/guard";
import { getOrderForGuest } from "@/server/services/orders";
import { getStoreSettings } from "@/server/services/settings";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{
    t?: string;
    returnError?: string;
    cancelError?: string;
    return?: string;
    cancelled?: string;
  }>;
}) {
  const [{ number }, query, settings] = await Promise.all([
    params,
    searchParams,
    getStoreSettings(),
  ]);
  const { t } = query;

  if (!t) notFound();

  const order = await getOrderForGuest(number, t);
  if (!order) notFound();

  const session = await getAuthSession();
  const claimable = order.userId === null;
  const ownedByViewer = session?.user.id === order.userId;

  const returnTo = `/orders/${encodeURIComponent(order.number)}?t=${encodeURIComponent(t)}`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
        Order confirmed
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{order.number}</h1>
      <p className="mt-2 text-sm text-muted">
        {ORDER_STATUS_LABEL[order.status] ?? order.status} · placed{" "}
        {order.placedAt.toLocaleDateString("en-AE", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>

      <OrderDetail order={order}>
        <OrderAftercare
          order={order}
          token={t}
          returnWindowDays={settings.returnWindowDays}
          returnError={query.returnError}
          cancelError={query.cancelError}
          returnRequested={query.return === "requested"}
          cancellationRequested={query.cancelled === "requested"}
        />

        <div className="mt-6 space-y-4">
          {claimable && session ? (
            <section className="rounded-xl border border-line bg-surface p-5">
              <h2 className="text-sm font-semibold">Save this order to your account</h2>
              <p className="mt-2 text-sm text-muted">
                Keep it in your order history on this and other devices. The token proves you own
                this lookup link.
              </p>
              <div className="mt-4">
                <ClaimOrderForm number={order.number} token={t} compact />
              </div>
            </section>
          ) : claimable ? (
            <section className="rounded-xl border border-line bg-surface p-5">
              <h2 className="text-sm font-semibold">Keep this order</h2>
              <p className="mt-2 text-sm text-muted">
                Sign in or create an account to save this order to your history.
              </p>
              <Link
                href={`/account/sign-in?next=${encodeURIComponent(returnTo)}`}
                className={buttonClass("secondary", "sm", "mt-4")}
              >
                Sign in to save
              </Link>
            </section>
          ) : ownedByViewer ? (
            <p className="text-sm text-muted">
              This order is in your account.{" "}
              <Link
                href={`/account/orders/${encodeURIComponent(order.number)}`}
                className="underline underline-offset-4 hover:text-ink"
              >
                View it in your order history
              </Link>
              .
            </p>
          ) : null}

          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold">Keep this link</h2>
            <p className="mt-2 text-sm text-muted">
              This page is your way back into the order without an account. It was also sent to{" "}
              {order.email}.
            </p>
          </section>
        </div>
      </OrderDetail>

      <Link href="/" className={buttonClass("secondary", "md", "mt-8")}>
        Continue shopping
      </Link>
    </div>
  );
}
