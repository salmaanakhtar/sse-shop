import Link from "next/link";
import { notFound } from "next/navigation";
import { ClaimOrderForm } from "@/components/storefront/claim-order-form";
import { OrderAftercare } from "@/components/storefront/order-aftercare";
import { OrderDetail, orderStatusLabel } from "@/components/storefront/order-detail";
import { buttonClass } from "@/components/ui/button";
import { formatDateFor, localePath, translate } from "@/lib/i18n";
import { getAuthSession } from "@/server/auth/guard";
import { getOrderForGuest } from "@/server/services/orders";
import { getLocale, getNumeralPreference } from "@/server/services/preferences";
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
  const [{ number }, query, settings, locale, numerals] = await Promise.all([
    params,
    searchParams,
    getStoreSettings(),
    getLocale(),
    getNumeralPreference(),
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
        {translate(locale, "order.confirmed")}
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{order.number}</h1>
      <p className="mt-2 text-sm text-muted">
        {orderStatusLabel(locale, order.status)} ·{" "}
        {translate(locale, "order.placedOn", {
          date: formatDateFor(order.placedAt, locale, numerals),
        })}
      </p>

      <OrderDetail order={order} locale={locale} numerals={numerals}>
        <OrderAftercare
          order={order}
          token={t}
          locale={locale}
          numerals={numerals}
          returnWindowDays={settings.returnWindowDays}
          returnError={query.returnError}
          cancelError={query.cancelError}
          returnRequested={query.return === "requested"}
          cancellationRequested={query.cancelled === "requested"}
        />

        <div className="mt-6 space-y-4">
          {claimable && session ? (
            <section className="rounded-xl border border-line bg-surface p-5">
              <h2 className="text-sm font-semibold">{translate(locale, "order.saveToAccount")}</h2>
              <p className="mt-2 text-sm text-muted">{translate(locale, "order.saveHelp")}</p>
              <div className="mt-4">
                <ClaimOrderForm number={order.number} token={t} compact />
              </div>
            </section>
          ) : claimable ? (
            <section className="rounded-xl border border-line bg-surface p-5">
              <h2 className="text-sm font-semibold">{translate(locale, "order.claimTitle")}</h2>
              <p className="mt-2 text-sm text-muted">{translate(locale, "order.claimBody")}</p>
              <Link
                href={`${localePath(locale, "/account/sign-in")}?next=${encodeURIComponent(returnTo)}`}
                className={buttonClass("secondary", "sm", "mt-4")}
              >
                {translate(locale, "order.signInToSave")}
              </Link>
            </section>
          ) : ownedByViewer ? (
            <p className="text-sm text-muted">
              {translate(locale, "order.inAccount")}{" "}
              <Link
                href={localePath(locale, `/account/orders/${encodeURIComponent(order.number)}`)}
                className="underline underline-offset-4 hover:text-ink"
              >
                {translate(locale, "order.viewInHistory")}
              </Link>
              .
            </p>
          ) : null}

          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold">{translate(locale, "order.keepLink")}</h2>
            <p className="mt-2 text-sm text-muted">
              {translate(locale, "order.keepLinkBody", { email: order.email })}
            </p>
          </section>
        </div>
      </OrderDetail>

      <Link
        href={localePath(locale, "/")}
        className={buttonClass("secondary", "md", "mt-8")}
      >
        {translate(locale, "order.continueShopping")}
      </Link>
    </div>
  );
}
