"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Result } from "@/lib/result";
import { fail } from "@/lib/result";
import { getAuthSession, requireUserAction } from "@/server/auth/guard";
import { checkRateLimit } from "@/server/security/rate-limit";
import { clientIp } from "@/server/security/request";
import { addToCart } from "@/server/services/cart";
import {
  createWishlist,
  deleteWishlist,
  getWishlist,
  listWishlistItems,
  removeWishlistItem,
  renameWishlist,
  setVariantWishlists,
} from "@/server/services/wishlists";

const nameSchema = z.string().trim().min(1).max(60);
const idSchema = z.string().trim().min(1);

function listUrl(id: string, error?: string): string {
  return `/account/wishlists/${id}${error ? `?error=${encodeURIComponent(error)}` : ""}`;
}

function listsUrl(error?: string): string {
  return `/account/wishlists${error ? `?error=${encodeURIComponent(error)}` : ""}`;
}

export async function createWishlistAction(formData: FormData): Promise<void> {
  const session = await requireUserAction();
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) redirect(listsUrl("Give the list a name under 60 characters."));

  const result = await createWishlist(session.user.id, parsed.data);
  if (!result.ok) redirect(listsUrl(result.error));

  revalidatePath("/account/wishlists");
  redirect(listUrl(result.data.id));
}

export async function renameWishlistAction(formData: FormData): Promise<void> {
  const session = await requireUserAction();
  const id = idSchema.safeParse(formData.get("id"));
  const name = nameSchema.safeParse(formData.get("name"));
  if (!id.success) redirect(listsUrl());
  if (!name.success) redirect(listUrl(id.data, "Give the list a name under 60 characters."));

  const result = await renameWishlist(session.user.id, id.data, name.data);
  if (!result.ok) redirect(listUrl(id.data, result.error));

  revalidatePath("/account/wishlists");
  revalidatePath(listUrl(id.data));
  redirect(listUrl(id.data));
}

export async function deleteWishlistAction(formData: FormData): Promise<void> {
  const session = await requireUserAction();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) redirect(listsUrl());

  const result = await deleteWishlist(session.user.id, id.data);
  if (!result.ok) redirect(listsUrl(result.error));

  revalidatePath("/account/wishlists");
  redirect(listsUrl());
}

export async function removeWishlistItemAction(formData: FormData): Promise<void> {
  const session = await requireUserAction();
  const wishlistId = idSchema.safeParse(formData.get("wishlistId"));
  const variantId = idSchema.safeParse(formData.get("variantId"));
  if (!wishlistId.success) redirect(listsUrl());
  if (!variantId.success) redirect(listUrl(wishlistId.data));

  const result = await removeWishlistItem(
    session.user.id,
    wishlistId.data,
    variantId.data,
  );
  if (!result.ok) redirect(listUrl(wishlistId.data, result.error));

  revalidatePath("/account/wishlists");
  revalidatePath(listUrl(wishlistId.data));
  redirect(listUrl(wishlistId.data));
}

const saveSchema = z.object({
  variantId: idSchema,
  wishlistIds: z.array(idSchema).max(50),
});

export async function setVariantWishlistsAction(
  variantId: string,
  wishlistIds: string[],
): Promise<Result<{ listIds: string[] }>> {
  const session = await getAuthSession();
  if (!session) return fail("Sign in to save items.");

  const limit = await checkRateLimit(
    `wishlist:set:${session.user.id}:${await clientIp()}`,
    60,
    60,
  );
  if (!limit.ok) return fail("Too many wishlist changes. Try again in a moment.");

  const parsed = saveSchema.safeParse({ variantId, wishlistIds });
  if (!parsed.success) return fail("Choose a valid list.");

  const result = await setVariantWishlists(
    session.user.id,
    parsed.data.variantId,
    parsed.data.wishlistIds,
  );

  if (result.ok) {
    revalidatePath("/account/wishlists");
  }

  return result;
}

export async function addWishlistToCartAction(formData: FormData): Promise<void> {
  const session = await requireUserAction();
  const limit = await checkRateLimit(
    `wishlist:checkout:${session.user.id}:${await clientIp()}`,
    20,
    60,
  );
  if (!limit.ok) redirect(listsUrl("Too many requests. Try again in a moment."));

  const wishlistId = idSchema.safeParse(formData.get("wishlistId"));
  if (!wishlistId.success) redirect(listsUrl());

  const wishlist = await getWishlist(session.user.id, wishlistId.data);
  if (!wishlist) redirect(listsUrl("That wishlist could not be found."));

  const selected = formData
    .getAll("variantIds")
    .map((value) => String(value))
    .filter(Boolean);

  if (selected.length === 0) {
    redirect(listUrl(wishlistId.data, "Choose at least one item."));
  }

  const items = await listWishlistItems(session.user.id, wishlistId.data);
  const owned = new Set(items.map((item) => item.variantId));
  const errors: string[] = [];

  for (const variantId of selected) {
    if (!owned.has(variantId)) {
      errors.push("One selected item is no longer in this list.");
      continue;
    }

    const result = await addToCart(variantId, 1);
    if (!result.ok) errors.push(result.error);
  }

  if (errors.length > 0) {
    revalidatePath("/cart");
    redirect(listUrl(wishlistId.data, [...new Set(errors)].join(" ")));
  }

  revalidatePath("/cart");
  revalidatePath("/checkout");
  revalidatePath("/", "layout");
  redirect("/checkout");
}
