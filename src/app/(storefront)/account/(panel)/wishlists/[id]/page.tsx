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
import { formatMoney } from "@/lib/money";
import { requireUserPage } from "@/server/auth/guard";
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
  const wishlist = await getWishlist(session.user.id, id);
  if (!wishlist) notFound();

  const items = await listWishlistItems(session.user.id, wishlist.id);
  await checkWishlistPriceDropsForUser(session.user.id).catch((checkError) => {
    console.error("wishlist price check failed", checkError);
  });

  const availableCount = items.filter((item) => item.available).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/account/wishlists"
            className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            All wishlists
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">{wishlist.name}</h2>
            {wishlist.isDefault ? (
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold tracking-wide text-brand uppercase">
                Default
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted">
            {items.length} {items.length === 1 ? "item" : "items"}
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
              List name
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
            Save name
          </Button>
        </form>

        {wishlist.isDefault ? (
          <p className="max-w-xs text-xs text-muted">
            The default list receives one-click saves from product pages.
          </p>
        ) : (
          <form action={deleteWishlistAction}>
            <input type="hidden" name="id" value={wishlist.id} />
            <ConfirmSubmitButton
              type="submit"
              message={`Delete ${wishlist.name}?`}
              className="text-xs text-muted underline-offset-4 hover:text-red-600 hover:underline"
            >
              Delete list
            </ConfirmSubmitButton>
          </form>
        )}
      </section>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center">
          <p className="text-sm text-muted">Nothing saved in this list yet.</p>
          <Link href="/" className="mt-3 inline-block text-sm text-brand hover:underline">
            Browse the shop
          </Link>
        </div>
      ) : (
        <form action={addWishlistToCartAction} className="space-y-3">
          <input type="hidden" name="wishlistId" value={wishlist.id} />

          {items.map((item) => (
            <div
              key={item.variantId}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4"
            >
              <input
                type="checkbox"
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
                  href={`/products/${item.productSlug}`}
                  className="text-sm font-medium hover:text-brand"
                >
                  {item.productTitle}
                </Link>
                <p className="mt-0.5 text-xs text-muted">{item.variantTitle}</p>
                <p className="mt-1 text-xs text-muted">
                  Saved at {formatMoney(item.addedPriceMinor)}
                </p>
                {item.available ? (
                  <p className="text-xs text-muted">{item.stockQty} in stock</p>
                ) : (
                  <p className="text-xs text-red-600">
                    {item.productStatus !== "active" ? "No longer available" : "Sold out"}
                  </p>
                )}
              </div>

              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">
                  {formatMoney(item.currentPriceMinor)}
                </p>
                {item.onSale ? (
                  <p className="text-xs text-muted line-through tabular-nums">
                    {formatMoney(item.priceMinor)}
                  </p>
                ) : null}
                <button
                  type="submit"
                  formAction={removeWishlistItemAction}
                  name="variantId"
                  value={item.variantId}
                  className="mt-2 text-xs text-muted underline-offset-4 hover:text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-xs text-muted">
              {availableCount === 0
                ? "No items in this list are available right now."
                : "Selected items are added to your cart and taken to checkout."}
            </p>
            <Button type="submit" disabled={availableCount === 0}>
              Add selected to cart &amp; checkout
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
