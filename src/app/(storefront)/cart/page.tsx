import Image from "next/image";
import Link from "next/link";
import { removeItemAction, updateQuantityAction } from "@/app/(storefront)/cart-actions";
import { buttonClass } from "@/components/ui/button";
import { localePath, translate } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { getCartView } from "@/server/services/cart";
import { getLocale, getNumeralPreference } from "@/server/services/preferences";

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, cart, locale, numerals] = await Promise.all([
    searchParams,
    getCartView(),
    getLocale(),
    getNumeralPreference(),
  ]);
  const money = (minor: number) => formatMoney(minor, { locale, numerals });

  if (!cart || cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {translate(locale, "cart.emptyTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted">{translate(locale, "cart.emptyBody")}</p>
        <Link href={localePath(locale, "/")} className={buttonClass("primary", "md", "mt-8")}>
          {translate(locale, "cart.browse")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        {translate(locale, "cart.title")}
      </h1>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
        <ul className="space-y-4">
          {cart.lines.map((line) => (
            <li
              key={line.itemId}
              className="flex gap-4 rounded-xl border border-line bg-surface p-4"
            >
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-page">
                {line.imageKey ? (
                  <Image
                    src={`/media/${line.imageKey}`}
                    alt={line.productTitle}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : null}
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <Link
                    href={localePath(locale, `/products/${line.productSlug}`)}
                    className="text-sm font-medium hover:underline"
                  >
                    {line.productTitle}
                  </Link>
                  {line.optionLabel ? (
                    <p className="mt-0.5 text-xs text-muted">{line.optionLabel}</p>
                  ) : null}
                  {!line.available ? (
                    <p className="mt-1 text-xs text-red-600">
                      {translate(locale, "cart.onlyAvailable", { count: line.stockQty })}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <form
                    action={updateQuantityAction}
                    className="inline-flex items-center rounded-lg border border-line"
                  >
                    <input type="hidden" name="itemId" value={line.itemId} />
                    <button
                      type="submit"
                      name="quantity"
                      value={line.quantity - 1}
                      aria-label={translate(locale, "cart.decrease", {
                        title: line.productTitle,
                      })}
                      className="h-8 w-8 text-muted hover:text-ink"
                    >
                      −
                    </button>
                    <span
                      className="min-w-6 text-center text-sm tabular-nums"
                      data-testid="cart-quantity"
                    >
                      {line.quantity}
                    </span>
                    <button
                      type="submit"
                      name="quantity"
                      value={line.quantity + 1}
                      aria-label={translate(locale, "cart.increase", {
                        title: line.productTitle,
                      })}
                      className="h-8 w-8 text-muted hover:text-ink"
                      disabled={line.quantity >= line.stockQty}
                    >
                      +
                    </button>
                  </form>

                  <div className="w-24 text-right">
                    <p className="text-sm font-medium tabular-nums">
                      {money(line.lineTotalMinor)}
                    </p>
                    {line.regularPriceMinor > line.unitPriceMinor ? (
                      <p className="text-[11px] text-muted line-through tabular-nums">
                        {money(line.regularPriceMinor * line.quantity)}
                      </p>
                    ) : null}
                  </div>

                  <form action={removeItemAction}>
                    <input type="hidden" name="itemId" value={line.itemId} />
                    <button
                      type="submit"
                      className="text-xs text-muted underline-offset-4 hover:text-red-600 hover:underline"
                    >
                      {translate(locale, "cart.remove")}
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold">{translate(locale, "cart.summary")}</h2>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">{translate(locale, "cart.subtotal")}</dt>
              <dd className="tabular-nums">{money(cart.totals.subtotalMinor)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">{translate(locale, "cart.delivery")}</dt>
              <dd className="tabular-nums">
                {cart.totals.shippingMinor === 0
                  ? translate(locale, "cart.free")
                  : money(cart.totals.shippingMinor)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold">
              <dt>{translate(locale, "cart.total")}</dt>
              <dd className="tabular-nums" data-testid="cart-total">
                {money(cart.totals.totalMinor)}
              </dd>
            </div>
          </dl>

          <p className="mt-2 text-xs text-muted">
            {translate(locale, "cart.includesVat", { amount: money(cart.totals.taxMinor) })}
          </p>

          <Link
            href={localePath(locale, "/checkout")}
            className={buttonClass("primary", "md", "mt-5 w-full")}
          >
            {translate(locale, "cart.checkout")}
          </Link>
        </aside>
      </div>
    </div>
  );
}
