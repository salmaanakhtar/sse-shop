import { and, avg, count, desc, eq, ne } from "drizzle-orm";
import { fail, ok, type Result } from "@/lib/result";
import { db } from "../db/client";
import {
  orderItems,
  orders,
  productReviews,
  products,
  users,
  variants,
} from "../db/schema";

export type ReviewView = {
  id: string;
  rating: number;
  title: string;
  body: string;
  authorName: string;
  createdAt: Date;
};

export type ReviewSummary = {
  average: number;
  count: number;
};

export type AdminReviewRow = {
  id: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  customerName: string;
  customerEmail: string;
  rating: number;
  title: string;
  body: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
};

export async function hasPurchasedProduct(
  userId: string,
  productId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: orderItems.id })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .innerJoin(variants, eq(variants.id, orderItems.variantId))
    .where(
      and(
        eq(orders.userId, userId),
        eq(orders.paymentStatus, "paid"),
        ne(orders.status, "cancelled"),
        eq(variants.productId, productId),
      ),
    )
    .limit(1);

  return Boolean(row);
}

export async function listApprovedReviews(productId: string): Promise<ReviewView[]> {
  const rows = await db
    .select({
      id: productReviews.id,
      rating: productReviews.rating,
      title: productReviews.title,
      body: productReviews.body,
      authorName: users.name,
      createdAt: productReviews.createdAt,
    })
    .from(productReviews)
    .innerJoin(users, eq(users.id, productReviews.userId))
    .where(
      and(eq(productReviews.productId, productId), eq(productReviews.status, "approved")),
    )
    .orderBy(desc(productReviews.createdAt));

  return rows.map((row) => ({
    ...row,
    authorName: row.authorName || "Verified buyer",
  }));
}

export async function getReviewSummary(productId: string): Promise<ReviewSummary> {
  const [row] = await db
    .select({
      average: avg(productReviews.rating),
      count: count(productReviews.id),
    })
    .from(productReviews)
    .where(
      and(eq(productReviews.productId, productId), eq(productReviews.status, "approved")),
    );

  return {
    average: row?.average ? Number(row.average) : 0,
    count: Number(row?.count ?? 0),
  };
}

export async function getMyReview(userId: string, productId: string) {
  const [row] = await db
    .select()
    .from(productReviews)
    .where(
      and(eq(productReviews.productId, productId), eq(productReviews.userId, userId)),
    )
    .limit(1);
  return row ?? null;
}

export async function submitReview(
  userId: string,
  productId: string,
  input: { rating: number; title: string; body: string },
): Promise<Result<{ status: "pending" }>> {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return fail("Choose a rating from 1 to 5.");
  }
  if (input.body.trim().length < 10) {
    return fail("Write at least 10 characters about the product.");
  }
  if (input.body.length > 2_000) {
    return fail("Keep the review under 2,000 characters.");
  }
  if (input.title.length > 120) {
    return fail("Keep the title under 120 characters.");
  }

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.status, "active")))
    .limit(1);
  if (!product) return fail("That product could not be found.");
  if (!(await hasPurchasedProduct(userId, productId))) {
    return fail("Only customers with a paid order for this product can review it.");
  }

  await db
    .insert(productReviews)
    .values({
      productId,
      userId,
      rating: input.rating,
      title: input.title.trim(),
      body: input.body.trim(),
      status: "pending",
    })
    .onConflictDoUpdate({
      target: [productReviews.productId, productReviews.userId],
      set: {
        rating: input.rating,
        title: input.title.trim(),
        body: input.body.trim(),
        status: "pending",
        updatedAt: new Date(),
      },
    });

  return ok({ status: "pending" });
}

export async function listAdminReviews(
  status?: "pending" | "approved" | "rejected",
): Promise<AdminReviewRow[]> {
  const base = db
    .select({
      id: productReviews.id,
      productId: products.id,
      productTitle: products.title,
      productSlug: products.slug,
      customerName: users.name,
      customerEmail: users.email,
      rating: productReviews.rating,
      title: productReviews.title,
      body: productReviews.body,
      status: productReviews.status,
      createdAt: productReviews.createdAt,
    })
    .from(productReviews)
    .innerJoin(products, eq(products.id, productReviews.productId))
    .innerJoin(users, eq(users.id, productReviews.userId));

  const rows = status
    ? await base
        .where(eq(productReviews.status, status))
        .orderBy(desc(productReviews.createdAt))
    : await base.orderBy(desc(productReviews.createdAt));

  return rows;
}

export async function moderateReview(
  id: string,
  status: "approved" | "rejected",
): Promise<Result<{ status: string }>> {
  const [updated] = await db
    .update(productReviews)
    .set({ status, updatedAt: new Date() })
    .where(eq(productReviews.id, id))
    .returning({ id: productReviews.id, status: productReviews.status });

  if (!updated) return fail("That review could not be found.");
  return ok({ status: updated.status });
}

export async function deleteReview(id: string): Promise<Result<{ deleted: true }>> {
  const [deleted] = await db
    .delete(productReviews)
    .where(eq(productReviews.id, id))
    .returning({ id: productReviews.id });
  if (!deleted) return fail("That review could not be found.");
  return ok({ deleted: true });
}
