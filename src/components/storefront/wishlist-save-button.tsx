"use client";

import Link from "next/link";
import { useEffect, useId, useState, useTransition } from "react";
import { setVariantWishlistsAction } from "@/app/(storefront)/wishlist-actions";
import { useStorePreferences } from "@/components/storefront/store-preferences";
import { Button } from "@/components/ui/button";
import { localePath } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type WishlistListOption = {
  id: string;
  name: string;
  isDefault: boolean;
};

export function WishlistSaveButton({
  variantId,
  lists,
  selectedListIds,
  signedIn,
}: {
  variantId: string;
  lists: WishlistListOption[];
  selectedListIds: string[];
  signedIn: boolean;
}) {
  const titleId = useId();
  const { t, locale } = useStorePreferences();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(selectedListIds);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!signedIn) {
    return (
      <Link
        href={localePath(locale, "/account/sign-in")}
        className="block text-center text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        {t("product.signInToSave")}
      </Link>
    );
  }

  function toggle(listId: string) {
    setSelected((current) =>
      current.includes(listId)
        ? current.filter((id) => id !== listId)
        : [...current, listId],
    );
    setError(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await setVariantWishlistsAction(variantId, selected);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setOpen(false);
      setMessage(
        selected.length === 0
          ? t("wishlist.removed")
          : t("product.savedTo", {
              count: selected.length,
              lists: t(selected.length === 1 ? "product.list" : "product.lists"),
            }),
      );
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMessage(null);
          setError(null);
        }}
        aria-haspopup="dialog"
        className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-page"
      >
        {selected.length > 0
          ? t("product.savedTo", {
              count: selected.length,
              lists: t(selected.length === 1 ? "product.list" : "product.lists"),
            })
          : t("product.save")}
      </button>

      {message ? (
        <p role="status" className="text-xs text-emerald-700">
          {message}
        </p>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-sm rounded-xl border border-line bg-surface p-5 shadow-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id={titleId} className="text-sm font-semibold">
                {t("wishlist.saveTitle")}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-muted hover:text-ink"
              >
                {t("common.close")}
              </button>
            </div>

            <p className="mt-1 text-xs text-muted">{t("wishlist.saveHelp")}</p>

            <div className="mt-4 space-y-2">
              {lists.map((list, index) => (
                <label
                  key={list.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                    selected.includes(list.id) ? "border-brand/40 bg-brand-soft/40" : "border-line",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(list.id)}
                    onChange={() => toggle(list.id)}
                    autoFocus={index === 0}
                    className="size-4"
                  />
                  <span>{list.name}</span>
                  {list.isDefault ? (
                    <span className="rounded-full bg-page px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted">
                      {t("wishlist.default")}
                    </span>
                  ) : null}
                </label>
              ))}
            </div>

            {error ? (
              <p role="alert" className="mt-3 text-xs text-red-600">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <Link
                href={localePath(locale, "/account/wishlists")}
                className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
              >
                {t("wishlist.manage")}
              </Link>
              <Button type="button" size="sm" onClick={save} disabled={pending}>
                {pending ? t("wishlist.saving") : t("wishlist.save")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
