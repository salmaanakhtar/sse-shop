import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/storefront/checkout-form";
import { EMIRATES, type Address } from "@/lib/address";
import { localePath, translate } from "@/lib/i18n";
import { priceCart } from "@/lib/pricing";
import { getAuthSession } from "@/server/auth/guard";
import { getDefaultAddress } from "@/server/services/addresses";
import { getCartView } from "@/server/services/cart";
import { getLocale } from "@/server/services/preferences";
import { getStoreSettings } from "@/server/services/settings";
import { quoteEmirates, type Emirate } from "@/server/services/shipping";

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
  const [cart, locale, settings] = await Promise.all([
    getCartView(),
    getLocale(),
    getStoreSettings(),
  ]);

  if (!cart || cart.lines.length === 0) redirect(localePath(locale, "/cart"));

  const session = await getAuthSession();
  const [shipping, billing] = session
    ? await Promise.all([
        getDefaultAddress(session.user.id, "shipping"),
        getDefaultAddress(session.user.id, "billing"),
      ])
    : [null, null];

  const rates = await quoteEmirates(cart.totals.subtotalMinor, cart.weightGrams);
  const lines = cart.lines.map((line) => ({
    unitPriceMinor: line.unitPriceMinor,
    quantity: line.quantity,
  }));
  const quotes = Object.fromEntries(
    EMIRATES.map((emirate) => {
      const totals = priceCart({
        lines,
        shippingMinor: rates[emirate].rateMinor,
        taxRateBp: settings.taxRateBp,
      });
      return [
        emirate,
        {
          shippingMinor: totals.shippingMinor,
          totalMinor: totals.totalMinor,
          taxMinor: totals.taxMinor,
        },
      ];
    }),
  ) as Record<Emirate, { shippingMinor: number; totalMinor: number; taxMinor: number }>;

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
          <Link href={localePath(locale, "/cart")} className="underline">
            Review your cart
          </Link>
          .
        </p>
      ) : null}

      <CheckoutForm
        quotes={quotes}
        subtotalMinor={cart.totals.subtotalMinor}
        lineItems={cart.lines.map((line) => ({
          itemId: line.itemId,
          title: line.productTitle,
          meta: `${line.optionLabel ? `${line.optionLabel} · ` : ""}× ${line.quantity}`,
          lineTotalMinor: line.lineTotalMinor,
        }))}
        defaults={{
          email: session?.user.email ?? "",
          fullName: shipping?.fullName ?? session?.user.name ?? "",
          phone: shipping?.phone ?? session?.user.phone ?? "",
          shipping: shipping ? toAddress(shipping) : null,
          billing: billing ? toAddress(billing) : null,
          signedIn: Boolean(session),
        }}
      />
    </div>
  );
}
