"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "../auth/guard";
import { db } from "../db/client";
import { auditLog, productReviews, products } from "../db/schema";
import { deleteReview, moderateReview } from "../services/reviews";

async function revalidateReviewProduct(reviewId: string): Promise<void> {
  const [row] = await db
    .select({ slug: products.slug })
    .from(productReviews)
    .innerJoin(products, eq(products.id, productReviews.productId))
    .where(eq(productReviews.id, reviewId))
    .limit(1);
  if (row) {
    revalidatePath(`/products/${row.slug}`);
    revalidatePath(`/ar/products/${row.slug}`);
  }
}

export async function moderateReviewAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  const status = formData.get("status") === "approved" ? "approved" : "rejected";
  if (!id) redirect("/admin/reviews");

  const result = await moderateReview(id, status);
  if (!result.ok) redirect("/admin/reviews");

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: `review.${status}`,
    entity: "product_reviews",
    entityId: id,
    after: { status },
  });

  await revalidateReviewProduct(id);
  revalidatePath("/admin/reviews");
  redirect(`/admin/reviews?status=${status}`);
}

export async function deleteReviewAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/admin/reviews");

  await revalidateReviewProduct(id);
  const result = await deleteReview(id);
  if (!result.ok) redirect("/admin/reviews");

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "review.delete",
    entity: "product_reviews",
    entityId: id,
  });

  revalidatePath("/admin/reviews");
  redirect("/admin/reviews");
}
