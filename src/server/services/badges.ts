import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { fail, ok, type Result } from "@/lib/result";
import { db } from "../db/client";
import { badges, productBadges } from "../db/schema";

export type BadgeRecord = typeof badges.$inferSelect;

export async function listBadges(): Promise<BadgeRecord[]> {
  return db
    .select()
    .from(badges)
    .orderBy(asc(badges.position), asc(badges.label));
}

export async function listActiveBadges(): Promise<BadgeRecord[]> {
  return db
    .select()
    .from(badges)
    .where(eq(badges.active, true))
    .orderBy(asc(badges.position), asc(badges.label));
}

export async function getBadge(id: string): Promise<BadgeRecord | null> {
  const [row] = await db.select().from(badges).where(eq(badges.id, id)).limit(1);
  return row ?? null;
}

export type BadgeInput = {
  label: string;
  tone: string;
  active: boolean;
};

async function nextPosition(): Promise<number> {
  const [row] = await db
    .select({ next: sql<number>`coalesce(max(${badges.position}), -1)::int + 1` })
    .from(badges);

  return row?.next ?? 0;
}

async function labelTaken(label: string, exceptId?: string): Promise<boolean> {
  const [row] = await db
    .select({ id: badges.id })
    .from(badges)
    .where(eq(badges.label, label))
    .limit(1);

  return Boolean(row && row.id !== exceptId);
}

export async function createBadge(input: BadgeInput): Promise<Result<BadgeRecord>> {
  if (await labelTaken(input.label)) {
    return fail("A badge with that label already exists.");
  }

  const [created] = await db
    .insert(badges)
    .values({ ...input, position: await nextPosition() })
    .returning();

  if (!created) return fail("Could not create the badge.");
  return ok(created);
}

export async function updateBadge(
  id: string,
  input: BadgeInput,
): Promise<Result<BadgeRecord>> {
  if (await labelTaken(input.label, id)) {
    return fail("A badge with that label already exists.");
  }

  const [updated] = await db
    .update(badges)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(badges.id, id))
    .returning();

  if (!updated) return fail("That badge could not be found.");
  return ok(updated);
}

export async function deleteBadge(id: string): Promise<Result<{ deleted: true }>> {
  const [deleted] = await db.delete(badges).where(eq(badges.id, id)).returning();
  if (!deleted) return fail("That badge could not be found.");
  return ok({ deleted: true });
}

export async function moveBadge(id: string, direction: "up" | "down"): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(badges)
      .orderBy(asc(badges.position), asc(badges.label));

    const index = rows.findIndex((row) => row.id === id);
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
          .update(badges)
          .set({ position, updatedAt: new Date() })
          .where(eq(badges.id, row.id));
      }
    }

    return true;
  });
}

export async function listProductBadgeIds(productId: string): Promise<string[]> {
  const rows = await db
    .select({ badgeId: productBadges.badgeId })
    .from(productBadges)
    .where(eq(productBadges.productId, productId));

  return rows.map((row) => row.badgeId);
}

export async function setProductBadges(
  productId: string,
  badgeIds: string[],
): Promise<Result<{ badgeIds: string[] }>> {
  const unique = [...new Set(badgeIds.filter(Boolean))];

  if (unique.length > 0) {
    const existing = await db
      .select({ id: badges.id })
      .from(badges)
      .where(inArray(badges.id, unique));

    if (existing.length !== unique.length) {
      return fail("One of those badges no longer exists.");
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(productBadges).where(eq(productBadges.productId, productId));
    if (unique.length > 0) {
      await tx
        .insert(productBadges)
        .values(unique.map((badgeId) => ({ productId, badgeId })));
    }
  });

  return ok({ badgeIds: unique });
}

export async function badgesForProducts(
  productIds: string[],
): Promise<Map<string, BadgeRecord[]>> {
  const map = new Map<string, BadgeRecord[]>();
  if (productIds.length === 0) return map;

  const rows = await db
    .select({
      productId: productBadges.productId,
      badge: badges,
    })
    .from(productBadges)
    .innerJoin(badges, eq(badges.id, productBadges.badgeId))
    .where(and(inArray(productBadges.productId, productIds), eq(badges.active, true)))
    .orderBy(asc(badges.position), asc(badges.label));

  for (const row of rows) {
    const list = map.get(row.productId) ?? [];
    list.push(row.badge);
    map.set(row.productId, list);
  }

  return map;
}
