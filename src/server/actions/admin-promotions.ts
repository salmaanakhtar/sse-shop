"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseDubaiDateTimeInput } from "@/lib/dates";
import { isPromotionTargetType } from "@/lib/promotions";
import { requireAdminAction } from "../auth/guard";
import { db } from "../db/client";
import { auditLog, promotions } from "../db/schema";
import { storeProductImage, uploadsRoot } from "../media/storage";
import {
  createPromotion,
  deletePromotion,
  getPromotionTarget,
  movePromotion,
  replacePromotionImage,
  updatePromotion,
  type PromotionInput,
} from "../services/promotions";

type PromotionFields = Omit<PromotionInput, "imageKey">;

function backToNew(error?: string): never {
  const query = error ? `?error=${encodeURIComponent(error)}` : "";
  redirect(`/admin/promotions/new${query}`);
}

function backToPromotion(id: string, error?: string): never {
  const query = error ? `?error=${encodeURIComponent(error)}` : "";
  redirect(`/admin/promotions/${id}${query}`);
}

async function readFields(formData: FormData): Promise<PromotionFields | string> {
  const headline = String(formData.get("headline") ?? "").trim();
  const subheadline = String(formData.get("subheadline") ?? "").trim();
  const ctaLabel = String(formData.get("ctaLabel") ?? "").trim() || "Shop now";
  const targetType = String(formData.get("targetType") ?? "");
  const targetId = String(formData.get("targetId") ?? "").trim();
  const imageAlt = String(formData.get("imageAlt") ?? "").trim();

  if (headline.length > 120) return "Keep the headline under 120 characters.";
  if (subheadline.length > 240) return "Keep the subheadline under 240 characters.";
  if (ctaLabel.length > 40) return "Keep the button label under 40 characters.";
  if (!isPromotionTargetType(targetType)) return "Choose where the slide should go.";
  if (!targetId) return "Choose a category, collection, or product.";

  const target = await getPromotionTarget(targetType, targetId);
  if (!target) return "That destination no longer exists. Choose another one.";

  const startsAt = parseDubaiDateTimeInput(String(formData.get("startsAt") ?? ""));
  if (startsAt === "invalid") return "Enter a valid start time.";
  const endsAt = parseDubaiDateTimeInput(String(formData.get("endsAt") ?? ""));
  if (endsAt === "invalid") return "Enter a valid end time.";
  if (startsAt && endsAt && startsAt >= endsAt) return "The slide must end after it starts.";

  return {
    headline,
    subheadline,
    ctaLabel,
    targetType,
    targetId,
    imageAlt,
    active: formData.get("active") === "on",
    startsAt,
    endsAt,
  };
}

function revalidateTarget(href: string | undefined): void {
  if (href) revalidatePath(href);
}

function promotionSummary(promotion: {
  headline: string;
  targetType: string;
  targetId: string | null;
  target?: { label: string; href: string } | null;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}) {
  return {
    headline: promotion.headline,
    targetType: promotion.targetType,
    targetId: promotion.targetId,
    targetLabel: promotion.target?.label ?? null,
    targetHref: promotion.target?.href ?? null,
    active: promotion.active,
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
  };
}

export async function createPromotionAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const fields = await readFields(formData);
  if (typeof fields === "string") backToNew(fields);

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    backToNew("Choose an image for the slide.");
  }

  let stored;
  try {
    stored = await storeProductImage(file);
  } catch (error) {
    backToNew(error instanceof Error ? error.message : "Upload failed.");
  }

  const promotion = await createPromotion({
    ...fields,
    imageKey: stored.storageKey,
    imageAlt: fields.imageAlt || fields.headline,
  });

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "promotion.create",
    entity: "promotions",
    entityId: promotion.id,
    after: promotionSummary(promotion),
  });

  revalidatePath("/");
  revalidatePath("/admin/promotions");
  revalidateTarget(promotion.target?.href);
  redirect("/admin/promotions");
}

export async function updatePromotionAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/admin/promotions");

  const fields = await readFields(formData);
  if (typeof fields === "string") backToPromotion(id, fields);

  const [before] = await db.select().from(promotions).where(eq(promotions.id, id)).limit(1);
  if (!before) backToPromotion(id, "That slide could not be found.");

  const updated = await updatePromotion(id, fields);
  if (!updated) backToPromotion(id, "That slide could not be found.");

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "promotion.update",
    entity: "promotions",
    entityId: id,
    before: {
      headline: before.headline,
      targetType: before.targetType,
      targetId: before.targetId,
      active: before.active,
      startsAt: before.startsAt,
      endsAt: before.endsAt,
    },
    after: promotionSummary(updated),
  });

  revalidatePath("/");
  revalidatePath("/admin/promotions");
  revalidatePath(`/admin/promotions/${id}`);
  revalidateTarget(updated.target?.href);
  backToPromotion(id);
}

export async function replacePromotionImageAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/admin/promotions");

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    backToPromotion(id, "Choose an image for the slide.");
  }

  const [before] = await db.select().from(promotions).where(eq(promotions.id, id)).limit(1);
  if (!before) backToPromotion(id, "That slide could not be found.");

  let stored;
  try {
    stored = await storeProductImage(file);
  } catch (error) {
    backToPromotion(id, error instanceof Error ? error.message : "Upload failed.");
  }

  const imageAlt = String(formData.get("imageAlt") ?? "").trim() || before.headline;
  const updated = await replacePromotionImage(id, stored.storageKey, imageAlt);
  if (!updated) backToPromotion(id, "That slide could not be found.");

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "promotion.image",
    entity: "promotions",
    entityId: id,
    before: { imageKey: before.imageKey },
    after: { imageKey: stored.storageKey },
  });

  if (before.imageKey && before.imageKey !== stored.storageKey) {
    await unlink(path.join(uploadsRoot(), before.imageKey)).catch(() => {
      // A missing file is already the desired state.
    });
  }

  revalidatePath("/");
  revalidatePath("/admin/promotions");
  revalidatePath(`/admin/promotions/${id}`);
  revalidateTarget(updated.target?.href);
  backToPromotion(id);
}

export async function deletePromotionAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/admin/promotions");

  const [beforeRow] = await db.select().from(promotions).where(eq(promotions.id, id)).limit(1);
  if (!beforeRow) redirect("/admin/promotions");

  const deleted = await deletePromotion(id);
  if (!deleted) redirect("/admin/promotions");

  const target = await getPromotionTarget(deleted.targetType, deleted.targetId ?? "");

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "promotion.delete",
    entity: "promotions",
    entityId: id,
    before: {
      headline: deleted.headline,
      targetType: deleted.targetType,
      targetId: deleted.targetId,
      imageKey: deleted.imageKey,
    },
  });

  await unlink(path.join(uploadsRoot(), deleted.imageKey)).catch(() => {
    // A missing file is already the desired state.
  });

  revalidatePath("/");
  revalidatePath("/admin/promotions");
  revalidateTarget(target?.href);
  redirect("/admin/promotions");
}

export async function movePromotionAction(formData: FormData): Promise<void> {
  await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  const direction = formData.get("direction") === "up" ? "up" : "down";

  if (id) await movePromotion(id, direction);

  revalidatePath("/");
  revalidatePath("/admin/promotions");
  redirect("/admin/promotions");
}
