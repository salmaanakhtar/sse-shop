"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserAction } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { products } from "@/server/db/schema";
import { checkRateLimit } from "@/server/security/rate-limit";
import { clientIp } from "@/server/security/request";
import { submitReview } from "@/server/services/reviews";

export type ReviewState = { error?: string; success?: string } | null;

const reviewSchema = z.object({
  productId: z.string().trim().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120),
  body: z.string().trim().min(10).max(2_000),
});

export async function submitReviewAction(
  _previous: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const session = await requireUserAction();
  const parsed = reviewSchema.safeParse({
    productId: formData.get("productId"),
    rating: formData.get("rating"),
    title: formData.get("title"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your review." };
  }

  const limit = await checkRateLimit(
    `review:${session.user.id}:${await clientIp()}`,
    5,
    3_600,
  );
  if (!limit.ok) {
    return { error: "Too many review submissions. Try again later." };
  }

  const result = await submitReview(session.user.id, parsed.data.productId, {
    rating: parsed.data.rating,
    title: parsed.data.title,
    body: parsed.data.body,
  });

  if (!result.ok) return { error: result.error };

  const [product] = await db
    .select({ slug: products.slug })
    .from(products)
    .where(eq(products.id, parsed.data.productId))
    .limit(1);

  if (product) {
    revalidatePath(`/products/${product.slug}`);
    revalidatePath(`/ar/products/${product.slug}`);
  }

  return { success: "Thanks. Your review is waiting for moderation." };
}
