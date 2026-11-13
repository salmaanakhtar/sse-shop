import { and, asc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { promotionStatus, type PromotionStatus } from "@/lib/promotions";
import { db } from "../db/client";
import { promotions } from "../db/schema";

export type PromotionSlide = {
  id: string;
  headline: string;
  subheadline: string;
  ctaLabel: string;
  href: string;
  imageKey: string;
  imageAlt: string;
};

export type AdminPromotion = typeof promotions.$inferSelect & {
  status: PromotionStatus;
};

const slideColumns = {
  id: promotions.id,
  headline: promotions.headline,
  subheadline: promotions.subheadline,
  ctaLabel: promotions.ctaLabel,
  href: promotions.href,
  imageKey: promotions.imageKey,
  imageAlt: promotions.imageAlt,
};

export async function listActivePromotions(now = new Date()): Promise<PromotionSlide[]> {
  return db
    .select(slideColumns)
    .from(promotions)
    .where(
      and(
        eq(promotions.active, true),
        or(isNull(promotions.startsAt), lte(promotions.startsAt, now)),
        or(isNull(promotions.endsAt), gt(promotions.endsAt, now)),
      ),
    )
    .orderBy(asc(promotions.position), asc(promotions.createdAt));
}

export async function listAdminPromotions(): Promise<AdminPromotion[]> {
  const rows = await db
    .select()
    .from(promotions)
    .orderBy(asc(promotions.position), asc(promotions.createdAt));

  const now = new Date();
  return rows.map((row) => ({ ...row, status: promotionStatus(row, now) }));
}

export async function getPromotion(id: string): Promise<AdminPromotion | null> {
  const [row] = await db.select().from(promotions).where(eq(promotions.id, id)).limit(1);
  if (!row) return null;
  return { ...row, status: promotionStatus(row) };
}

export type PromotionInput = {
  headline: string;
  subheadline: string;
  ctaLabel: string;
  href: string;
  imageKey: string;
  imageAlt: string;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

export async function createPromotion(input: PromotionInput): Promise<AdminPromotion> {
  const [positionRow] = await db
    .select({ next: sql<number>`coalesce(max(${promotions.position}), -1)::int + 1` })
    .from(promotions);

  const [created] = await db
    .insert(promotions)
    .values({
      ...input,
      position: positionRow?.next ?? 0,
    })
    .returning();

  if (!created) throw new Error("Could not create the promotion.");

  return { ...created, status: promotionStatus(created) };
}

export async function updatePromotion(
  id: string,
  input: Omit<PromotionInput, "imageKey">,
): Promise<AdminPromotion | null> {
  const [updated] = await db
    .update(promotions)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(promotions.id, id))
    .returning();

  if (!updated) return null;
  return { ...updated, status: promotionStatus(updated) };
}

export async function replacePromotionImage(
  id: string,
  imageKey: string,
  imageAlt: string,
): Promise<AdminPromotion | null> {
  const [updated] = await db
    .update(promotions)
    .set({ imageKey, imageAlt, updatedAt: new Date() })
    .where(eq(promotions.id, id))
    .returning();

  if (!updated) return null;
  return { ...updated, status: promotionStatus(updated) };
}

export async function deletePromotion(id: string): Promise<typeof promotions.$inferSelect | null> {
  const [deleted] = await db.delete(promotions).where(eq(promotions.id, id)).returning();
  return deleted ?? null;
}

export async function movePromotion(
  id: string,
  direction: "up" | "down",
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(promotions)
      .orderBy(asc(promotions.position), asc(promotions.createdAt));

    const index = rows.findIndex((row) => row.id === id);
    if (index === -1) return false;

    const swapIndex = direction === "up" ? index - 1 : index + 1;
    const current = rows[index];
    const swap = rows[swapIndex];
    if (!current || !swap) return false;

    const reordered = [...rows];
    reordered[index] = swap;
    reordered[swapIndex] = current;

    for (const [position, row] of reordered.entries()) {
      if (row.position !== position) {
        await tx
          .update(promotions)
          .set({ position, updatedAt: new Date() })
          .where(eq(promotions.id, row.id));
      }
    }

    return true;
  });
}
