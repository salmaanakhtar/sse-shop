import Link from "next/link";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { localePath, translate } from "@/lib/i18n";
import { requireUserPage } from "@/server/auth/guard";
import {
  createWishlistAction,
  deleteWishlistAction,
} from "@/app/(storefront)/wishlist-actions";
import { getLocale } from "@/server/services/preferences";
import {
  checkWishlistPriceDropsForUser,
  listWishlists,
} from "@/server/services/wishlists";

export const metadata = { title: "Wishlists" };

export default async function WishlistsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireUserPage();
  const [{ error }, lists, locale] = await Promise.all([
    searchParams,
    listWishlists(session.user.id),
    getLocale(),
  ]);

  await checkWishlistPriceDropsForUser(session.user.id).catch((error) => {
    console.error("wishlist price check failed", error);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {translate(locale, "wishlist.title")}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            {translate(locale, "wishlist.body")}
          </p>
        </div>
        <Link href={localePath(locale, "/")} className="text-sm text-muted hover:text-ink">
          {translate(locale, "cart.browse")}
        </Link>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <form
        action={createWishlistAction}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-5"
      >
        <div className="min-w-56 flex-1">
          <label
            htmlFor="new-wishlist-name"
            className="mb-1.5 block text-xs font-semibold tracking-wide text-muted uppercase"
          >
            {translate(locale, "wishlist.newName")}
          </label>
          <Input
            id="new-wishlist-name"
            name="name"
            required
            maxLength={60}
            placeholder="Gifts, Eid, Studio…"
          />
        </div>
        <Button type="submit" size="sm">
          {translate(locale, "wishlist.create")}
        </Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2">
        {lists.map((list) => (
          <article
            key={list.id}
            className="rounded-xl border border-line bg-surface p-5 transition-colors hover:border-brand/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  href={localePath(locale, `/account/wishlists/${list.id}`)}
                  className="font-medium hover:text-brand"
                >
                  {list.name}
                </Link>
                <p className="mt-1 text-xs text-muted">
                  {translate(locale, list.itemCount === 1 ? "wishlist.item" : "wishlist.items", {
                    count: list.itemCount,
                  })}
                </p>
              </div>
              {list.isDefault ? (
                <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold tracking-wide text-brand uppercase">
                  {translate(locale, "wishlist.default")}
                </span>
              ) : (
                <form action={deleteWishlistAction}>
                  <input type="hidden" name="id" value={list.id} />
                  <ConfirmSubmitButton
                    type="submit"
                    message={`Delete ${list.name}?`}
                    className="text-xs text-muted underline-offset-4 hover:text-red-600 hover:underline"
                  >
                    {translate(locale, "wishlist.delete")}
                  </ConfirmSubmitButton>
                </form>
              )}
            </div>

            <Link
              href={localePath(locale, `/account/wishlists/${list.id}`)}
              className="mt-4 inline-block text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              {translate(locale, "wishlist.open")}
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
