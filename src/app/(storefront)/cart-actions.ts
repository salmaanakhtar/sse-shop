"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Result } from "@/lib/result";
import { addToCart, removeCartItem, setCartItemQuantity } from "@/server/services/cart";

export async function addToCartAction(
  variantId: string,
  quantity: number,
): Promise<Result<{ cartCount: number }>> {
  const result = await addToCart(variantId, quantity);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updateQuantityAction(formData: FormData): Promise<void> {
  const itemId = String(formData.get("itemId") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);

  const result = await setCartItemQuantity(itemId, quantity);
  if (!result.ok) {
    redirect(`/cart?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/cart");
  revalidatePath("/", "layout");
}

export async function removeItemAction(formData: FormData): Promise<void> {
  const itemId = String(formData.get("itemId") ?? "");

  const result = await removeCartItem(itemId);
  if (!result.ok) {
    redirect(`/cart?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/cart");
  revalidatePath("/", "layout");
}
