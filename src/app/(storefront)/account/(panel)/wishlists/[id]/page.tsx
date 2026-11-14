import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addWishlistToCartAction,
  removeWishlistItemAction,
  renameWishlistAction,
  deleteWishlistAction,
} from "@/app/(storefront)/wishlist-actions";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/field";
import { localePath, translate } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { requireUserPage } from "@/server/auth/guard";
import { getLocale, getNumeralPreference } from "@/server/services/preferences";
import {
  checkWishlistPriceDropsForUser,
  getWishlist,
  listWishlistItems,
} from "@/server/services/wishlists";

export const metadata = { title: "Wishlist" };

export default async function WishlistDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireUserPage();
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const [wishlist, locale, numerals] = await Promise.all([
    getWishlist(session.user.id, id),
    getLocale(),
    getNumeralPreference(),
  ]);
  if (!wishlist) notFound();

  const items = await listWishlistItems(session.user.id, wishlist.id);
  await checkWishlistPriceDropsForUser(session.user.id).catch((checkError) => {
    console.error("wishlist price check failed", checkError);
  });
  const money = (minor: number) => formatMoney(minor, { locale, numerals });

  const availableCount = items.filter((item) => item.available).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={localePath(locale, "/account/wishlists")}
            className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            {translate(locale, "wishlist.all")}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">{wishlist.name}</h2>
            {wishlist.isDefault ? (
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold tracking-wide text-brand uppercase">
                {translate(locale, "wishlist.default")}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted">
            {translate(locale, items.length === 1 ? "wishlist.item" : "wishlist.items", {
              count: items.length,
            })}
          </p>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <section className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-line bg-surface p-5">
        <form action={renameWishlistAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={wishlist.id} />
          <div>
            <label
              htmlFor="wishlist-name"
              className="mb-1.5 block text-xs font-semibold tracking-wide text-muted uppercase"
            >
              {translate(locale, "wishlist.listName")}
            </label>
            <Input
              id="wishlist-name"
              name="name"
              required
              maxLength={60}
              defaultValue={wishlist.name}
              className="max-w-56"
            />
          </div>
          <Button type="submit" size="sm" variant="secondary">
            {translate(locale, "wishlist.saveName")}
          </Button>
        </form>

        {wishlist.isDefault ? (
          <p className="max-w-xs text-xs text-muted">{translate(locale, "wishlist.defaultHelp")}</p>
        ) : (
          <form action={deleteWishlistAction}>
            <input type="hidden" name="id" value={wishlist.id} />
            <ConfirmSubmitButton
              type="submit"
              message={`Delete ${wishlist.name}?`}
              className="text-xs text-muted underline-offset-4 hover:text-red-600 hover:underline"
            >
              {translate(locale, "wishlist.delete")}
            </ConfirmSubmitButton>
          </form>
        )}
      </section>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center">
          <p className="text-sm text-muted">{translate(locale, "wishlist.empty")}</p>
          <Link
            href={localePath(locale, "/")}
            className="mt-3 inline-block text-sm text-brand hover:underline"
          >
            {translate(locale, "wishlist.browse")}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.variantId}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4"
            >
              <input
                type="checkbox"
                form="wishlist-checkout"
                name="variantIds"
                value={item.variantId}
                defaultChecked={item.available}
                disabled={!item.available}
                aria-label={`Select ${item.productTitle} ${item.variantTitle}`}
                className="size-4"
              />

              <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-line bg-page">
                {item.imageKey ? (
                  <Image
                    src={`/media/${item.imageKey}`}
                    alt={item.imageAlt}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-muted">
                    No image
                  </div>
                )}
              </div>

              <div className="min-w-40 flex-1">
                <Link
                  href={localePath(locale, `/products/${item.productSlug}`)}
                  className="text-sm font-medium hover:text-brand"
                >
                  {item.productTitle}
                </Link>
                <p className="mt-0.5 text-xs text-muted">{item.variantTitle}</p>
                <p className="mt-1 text-xs text-muted">
                  {translate(locale, "wishlist.savedAt", {
                    amount: money(item.addedPriceMinor),
                  })}
                </p>
                {item.available ? (
                  <p className="text-xs text-muted">
                    {translate(locale, "wishlist.inStock", { count: item.stockQty })}
                  </p>
                ) : (
                  <p className="text-xs text-red-600">
                    {translate(
                      locale,
                      item.productStatus !== "active"
                        ? "wishlist.noLonger"
                        : "wishlist.soldOut",
                    )}
                  </p>
                )}
              </div>

              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">
                  {money(item.currentPriceMinor)}
                </p>
                {item.onSale ? (
                  <p className="text-xs text-muted line-through tabular-nums">
                    {money(item.priceMinor)}
                  </p>
                ) : null}
                <form action={removeWishlistItemAction}>
                  <input type="hidden" name="wishlistId" value={wishlist.id} />
                  <input type="hidden" name="variantId" value={item.variantId} />
                  <button
                    type="submit"
                    className="mt-2 text-xs text-muted underline-offset-4 hover:text-red-600 hover:underline"
                  >
                    {translate(locale, "wishlist.remove")}
                  </button>
                </form>
              </div>
            </div>
          ))}

          <form
            id="wishlist-checkout"
            action={addWishlistToCartAction}
            className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"
          >
            <input type="hidden" name="wishlistId" value={wishlist.id} />
            <p className="text-xs text-muted">
              {translate(
                locale,
                availableCount === 0 ? "wishlist.noneAvailable" : "wishlist.selectedHelp",
              )}
            </p>
            <Button type="submit" disabled={availableCount === 0}>
              {translate(locale, "wishlist.checkout")}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
