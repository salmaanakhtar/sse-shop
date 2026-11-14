import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/storefront/checkout-form";
import type { Address } from "@/lib/address";
import { localePath, translate } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { getAuthSession } from "@/server/auth/guard";
import { getDefaultAddress } from "@/server/services/addresses";
import { getCartView } from "@/server/services/cart";
import { getLocale, getNumeralPreference } from "@/server/services/preferences";

function toAddress(address: NonNullable<Awaited<ReturnType<typeof getDefaultAddress>>>): Address {
  return {
    fullName: address.fullName,
    phone: address.phone,
    emirate: address.emirate as Address["emirate"],
    street: address.street,
    building: address.building,
    area: address.area,
    poBox: address.poBox,
    notes: address.notes,
  };
}

export default async function CheckoutPage() {
  const [cart, locale, numerals] = await Promise.all([
    getCartView(),
    getLocale(),
    getNumeralPreference(),
  ]);

  if (!cart || cart.lines.length === 0) redirect(localePath(locale, "/cart"));
  const money = (minor: number) => formatMoney(minor, { locale, numerals });

  const session = await getAuthSession();
  const [shipping, billing] = session
    ? await Promise.all([
        getDefaultAddress(session.user.id, "shipping"),
        getDefaultAddress(session.user.id, "billing"),
      ])
    : [null, null];

  const blocked = cart.lines.filter((line) => !line.available);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {translate(locale, "checkout.title")}
        </h1>
        <Link
          href={localePath(locale, "/cart")}
          className="text-sm text-muted underline-offset-4 hover:underline"
        >
          {translate(locale, "checkout.backToCart")}
        </Link>
      </div>

      {blocked.length > 0 ? (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Some items are no longer available in the quantity you chose.{" "}
          <Link href="/cart" className="underline">
            Review your cart
          </Link>
          .
        </p>
      ) : null}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_340px]">
        <CheckoutForm
          expectedTotalMinor={cart.totals.totalMinor}
          defaults={{
            email: session?.user.email ?? "",
            fullName: shipping?.fullName ?? session?.user.name ?? "",
            phone: shipping?.phone ?? session?.user.phone ?? "",
            shipping: shipping ? toAddress(shipping) : null,
            billing: billing ? toAddress(billing) : null,
            signedIn: Boolean(session),
          }}
        />

        <aside className="h-fit rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">{translate(locale, "checkout.yourOrder")}</h2>

          <ul className="mt-4 space-y-3 text-sm">
            {cart.lines.map((line) => (
              <li key={line.itemId} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate">{line.productTitle}</span>
                  <span className="text-xs text-muted">
                    {line.optionLabel ? `${line.optionLabel} · ` : ""}× {line.quantity}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">{money(line.lineTotalMinor)}</span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">{translate(locale, "checkout.subtotal")}</dt>
              <dd className="tabular-nums">{money(cart.totals.subtotalMinor)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">{translate(locale, "checkout.delivery")}</dt>
              <dd className="tabular-nums">
                {cart.totals.shippingMinor === 0
                  ? translate(locale, "checkout.free")
                  : money(cart.totals.shippingMinor)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold">
              <dt>{translate(locale, "checkout.total")}</dt>
              <dd className="tabular-nums">{money(cart.totals.totalMinor)}</dd>
            </div>
          </dl>

          <p className="mt-2 text-xs text-muted">
            {translate(locale, "checkout.includesVat", { amount: money(cart.totals.taxMinor) })}
          </p>
        </aside>
      </div>
    </div>
  );
}
