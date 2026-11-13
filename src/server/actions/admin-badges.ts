"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isBadgeTone } from "@/lib/badges";
import { requireAdminAction } from "../auth/guard";
import { db } from "../db/client";
import { auditLog, products } from "../db/schema";
import {
  createBadge,
  deleteBadge,
  getBadge,
  listProductBadgeIds,
  moveBadge,
  setProductBadges,
  updateBadge,
  type BadgeInput,
} from "../services/badges";

function backToList(error?: string): never {
  redirect(`/admin/badges${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

function backToBadge(id: string, error?: string): never {
  redirect(`/admin/badges/${id}${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

function readBadge(formData: FormData): BadgeInput | string {
  const label = String(formData.get("label") ?? "").trim();
  const tone = String(formData.get("tone") ?? "brand");

  if (label.length < 2) return "Give the badge a label.";
  if (label.length > 40) return "Keep the label under 40 characters.";
  if (!isBadgeTone(tone)) return "Choose a valid badge tone.";

  return {
    label,
    tone,
    active: formData.get("active") === "on",
  };
}

function summary(badge: { label: string; tone: string; active: boolean }) {
  return { label: badge.label, tone: badge.tone, active: badge.active };
}

export async function createBadgeAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const input = readBadge(formData);
  if (typeof input === "string") backToList(input);

  const result = await createBadge(input);
  if (!result.ok) backToList(result.error);

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "badge.create",
    entity: "badges",
    entityId: result.data.id,
    after: summary(result.data),
  });

  revalidatePath("/");
  revalidatePath("/admin/badges");
  backToList();
}

export async function updateBadgeAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) backToList();

  const before = await getBadge(id);
  if (!before) backToBadge(id, "That badge could not be found.");

  const input = readBadge(formData);
  if (typeof input === "string") backToBadge(id, input);

  const result = await updateBadge(id, input);
  if (!result.ok) backToBadge(id, result.error);

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "badge.update",
    entity: "badges",
    entityId: id,
    before: summary(before),
    after: summary(result.data),
  });

  revalidatePath("/");
  revalidatePath("/admin/badges");
  revalidatePath(`/admin/badges/${id}`);
  backToBadge(id);
}

export async function deleteBadgeAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) backToList();

  const before = await getBadge(id);
  if (!before) backToList();

  const result = await deleteBadge(id);
  if (!result.ok) backToList(result.error);

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "badge.delete",
    entity: "badges",
    entityId: id,
    before: summary(before),
  });

  revalidatePath("/");
  revalidatePath("/admin/badges");
  backToList();
}

export async function moveBadgeAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  const direction = formData.get("direction") === "up" ? "up" : "down";
  if (!id) backToList();

  const before = await getBadge(id);
  if (!before) backToList();

  const moved = await moveBadge(id, direction);
  if (!moved) backToList("That badge cannot move any further.");

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "badge.move",
    entity: "badges",
    entityId: id,
    before: { position: before.position },
    after: { direction },
  });

  revalidatePath("/");
  revalidatePath("/admin/badges");
  backToList();
}

export async function setProductBadgesAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const productId = String(formData.get("productId") ?? "").trim();
  if (!productId) redirect("/admin/products");

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) redirect("/admin/products");

  const badgeIds = formData
    .getAll("badgeIds")
    .map((value) => String(value))
    .filter(Boolean);

  const before = await listProductBadgeIds(productId);
  const result = await setProductBadges(productId, badgeIds);

  if (!result.ok) {
    redirect(
      `/admin/products/${productId}?error=${encodeURIComponent(result.error)}#badges`,
    );
  }

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "product.badges",
    entity: "products",
    entityId: productId,
    before: { badgeIds: before },
    after: { badgeIds: result.data.badgeIds },
  });

  revalidatePath("/");
  revalidatePath(`/admin/products/${productId}`);
  redirect(`/admin/products/${productId}#badges`);
}
