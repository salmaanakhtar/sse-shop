import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderAftercare } from "@/components/storefront/order-aftercare";
import { OrderDetail, orderStatusLabel } from "@/components/storefront/order-detail";
import { buttonClass } from "@/components/ui/button";
import { formatDateFor, localePath, translate } from "@/lib/i18n";
import { requireUserPage } from "@/server/auth/guard";
import { getOrderForCustomer } from "@/server/services/orders";
import { getLocale, getNumeralPreference } from "@/server/services/preferences";
import { getStoreSettings } from "@/server/services/settings";

export const metadata = { title: "Order details" };

export default async function AccountOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{
    returnError?: string;
    cancelError?: string;
    return?: string;
    cancelled?: string;
  }>;
}) {
  const session = await requireUserPage();
  const [{ number }, query, settings, locale, numerals] = await Promise.all([
    params,
    searchParams,
    getStoreSettings(),
    getLocale(),
    getNumeralPreference(),
  ]);

  const order = await getOrderForCustomer(number, session.user.id);
  if (!order) notFound();

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
            {orderStatusLabel(locale, order.status)}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{order.number}</h2>
          <p className="mt-1 text-sm text-muted">
            {translate(locale, "order.placedOn", {
              date: formatDateFor(order.placedAt, locale, numerals),
            })}
          </p>
        </div>

        <Link
          href={localePath(locale, "/account/orders")}
          className={buttonClass("secondary", "sm")}
        >
          {translate(locale, "order.all")}
        </Link>
      </div>

      <OrderDetail order={order} locale={locale} numerals={numerals}>
        <OrderAftercare
          order={order}
          locale={locale}
          numerals={numerals}
          returnWindowDays={settings.returnWindowDays}
          returnError={query.returnError}
          cancelError={query.cancelError}
          returnRequested={query.return === "requested"}
          cancellationRequested={query.cancelled === "requested"}
        />
      </OrderDetail>
    </div>
  );
}
