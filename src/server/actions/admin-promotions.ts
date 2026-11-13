"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseDubaiDateTimeInput } from "@/lib/dates";
import { isPromotionRowKind } from "@/lib/promotions";
import { requireAdminAction } from "../auth/guard";
import { db } from "../db/client";
import { auditLog, promotions } from "../db/schema";
import { storeProductImage, uploadsRoot } from "../media/storage";
import { slugify } from "../services/catalog";
import {
  addPromotionRow,
  addPromotionRowProducts,
  createPromotion,
  deletePromotion,
  deletePromotionRow,
  getPromotionRow,
  movePromotion,
  movePromotionRow,
  removePromotionRowProduct,
  replacePromotionImage,
  updatePromotion,
  updatePromotionRowTitle,
  type PromotionInput,
  type PromotionRowInput,
} from "../services/promotions";

type PromotionFields = Omit<PromotionInput, "imageKey">;

function backToNew(error?: string): never {
  const query = error ? `?error=${encodeURIComponent(error)}` : "";
  redirect(`/admin/promotions/new${query}`);
}

function backToPromotion(id: string, error?: string, anchor = ""): never {
  const query = error ? `?error=${encodeURIComponent(error)}` : "";
  const hash = anchor ? `#${anchor}` : "";
  redirect(`/admin/promotions/${id}${query}${hash}`);
}

function readFields(formData: FormData): PromotionFields | string {
  const headline = String(formData.get("headline") ?? "").trim();
  const subheadline = String(formData.get("subheadline") ?? "").trim();
  const ctaLabel = String(formData.get("ctaLabel") ?? "").trim() || "Shop now";
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const slug = slugify(rawSlug || headline);
  const imageAlt = String(formData.get("imageAlt") ?? "").trim();

  if (headline.length > 120) return "Keep the headline under 120 characters.";
  if (subheadline.length > 240) return "Keep the subheadline under 240 characters.";
  if (ctaLabel.length > 40) return "Keep the button label under 40 characters.";
  if (!slug) return "Enter a URL slug for the promotion page.";

  const startsAt = parseDubaiDateTimeInput(String(formData.get("startsAt") ?? ""));
  if (startsAt === "invalid") return "Enter a valid start time.";
  const endsAt = parseDubaiDateTimeInput(String(formData.get("endsAt") ?? ""));
  if (endsAt === "invalid") return "Enter a valid end time.";
  if (startsAt && endsAt && startsAt >= endsAt) return "The slide must end after it starts.";

  return {
    slug,
    headline,
    subheadline,
    ctaLabel,
    imageAlt,
    active: formData.get("active") === "on",
    startsAt,
    endsAt,
  };
}

function revalidatePromotion(slug: string): void {
  revalidatePath("/");
  revalidatePath("/admin/promotions");
  revalidatePath(`/promotions/${slug}`);
}

function promotionSummary(promotion: {
  slug: string;
  headline: string;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}) {
  return {
    slug: promotion.slug,
    headline: promotion.headline,
    active: promotion.active,
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
  };
}

function rowSummary(row: {
  kind: string;
  title: string;
  categoryId: string | null;
  collectionId: string | null;
}) {
  return {
    kind: row.kind,
    title: row.title,
    categoryId: row.categoryId,
    collectionId: row.collectionId,
  };
}

export async function createPromotionAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const fields = readFields(formData);
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

  let promotion;
  try {
    promotion = await createPromotion({
      ...fields,
      imageKey: stored.storageKey,
      imageAlt: fields.imageAlt || fields.headline,
    });
  } catch (error) {
    await unlink(path.join(uploadsRoot(), stored.storageKey)).catch(() => {
      // A missing file is already the desired state.
    });
    backToNew(error instanceof Error ? error.message : "Could not create the promotion.");
  }

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "promotion.create",
    entity: "promotions",
    entityId: promotion.id,
    after: promotionSummary(promotion),
  });

  revalidatePromotion(promotion.slug);
  redirect(`/admin/promotions/${promotion.id}#rows`);
}

export async function updatePromotionAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/admin/promotions");

  const fields = readFields(formData);
  if (typeof fields === "string") backToPromotion(id, fields);

  const [before] = await db.select().from(promotions).where(eq(promotions.id, id)).limit(1);
  if (!before) backToPromotion(id, "That slide could not be found.");

  let updated;
  try {
    updated = await updatePromotion(id, fields);
  } catch (error) {
    backToPromotion(id, error instanceof Error ? error.message : "Could not save the promotion.");
  }
  if (!updated) backToPromotion(id, "That slide could not be found.");

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "promotion.update",
    entity: "promotions",
    entityId: id,
    before: promotionSummary(before),
    after: promotionSummary(updated),
  });

  revalidatePromotion(before.slug);
  revalidatePromotion(updated.slug);
  revalidatePath(`/admin/promotions/${id}`);
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

  revalidatePromotion(updated.slug);
  revalidatePath(`/admin/promotions/${id}`);
  backToPromotion(id);
}

export async function deletePromotionAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/admin/promotions");

  const [before] = await db.select().from(promotions).where(eq(promotions.id, id)).limit(1);
  if (!before) redirect("/admin/promotions");

  const deleted = await deletePromotion(id);
  if (!deleted) redirect("/admin/promotions");

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "promotion.delete",
    entity: "promotions",
    entityId: id,
    before: {
      ...promotionSummary(deleted),
      imageKey: deleted.imageKey,
    },
  });

  await unlink(path.join(uploadsRoot(), deleted.imageKey)).catch(() => {
    // A missing file is already the desired state.
  });

  revalidatePromotion(before.slug);
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

function readRowInput(formData: FormData): PromotionRowInput | string {
  const kind = String(formData.get("kind") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!isPromotionRowKind(kind)) return "Choose a row type.";

  if (kind === "category") {
    const categoryId = String(formData.get("sourceId") ?? "").trim();
    if (!categoryId) return "Choose a category.";
    return { kind, categoryId, title };
  }

  if (kind === "collection") {
    const collectionId = String(formData.get("sourceId") ?? "").trim();
    if (!collectionId) return "Choose a collection.";
    return { kind, collectionId, title };
  }

  const productIds = formData
    .getAll("productIds")
    .map((value) => String(value))
    .filter(Boolean);
  return { kind, productIds, title };
}

export async function addPromotionRowAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const promotionId = String(formData.get("promotionId") ?? "").trim();
  if (!promotionId) redirect("/admin/promotions");

  const input = readRowInput(formData);
  if (typeof input === "string") backToPromotion(promotionId, input, "rows");

  const result = await addPromotionRow(promotionId, input);
  if (!result.ok) backToPromotion(promotionId, result.error, "rows");

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "promotion.row.add",
    entity: "promotions",
    entityId: promotionId,
    after: input,
  });

  revalidatePath(`/admin/promotions/${promotionId}`);
  revalidatePath("/");
  backToPromotion(promotionId, undefined, "rows");
}

export async function updatePromotionRowTitleAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const promotionId = String(formData.get("promotionId") ?? "").trim();
  const rowId = String(formData.get("rowId") ?? "").trim();
  if (!promotionId || !rowId) redirect("/admin/promotions");

  const row = await getPromotionRow(rowId);
  if (!row || row.promotionId !== promotionId) {
    backToPromotion(promotionId, "That row could not be found.", "rows");
  }

  const result = await updatePromotionRowTitle(rowId, String(formData.get("title") ?? ""));
  if (!result.ok) backToPromotion(promotionId, result.error, "rows");

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "promotion.row.title",
    entity: "promotions",
    entityId: promotionId,
    before: rowSummary(row),
    after: { ...rowSummary(row), title: result.data.title },
  });

  revalidatePath(`/admin/promotions/${promotionId}`);
  revalidatePath("/");
  backToPromotion(promotionId, undefined, "rows");
}

export async function movePromotionRowAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const promotionId = String(formData.get("promotionId") ?? "").trim();
  const rowId = String(formData.get("rowId") ?? "").trim();
  const direction = formData.get("direction") === "up" ? "up" : "down";
  if (!promotionId || !rowId) redirect("/admin/promotions");

  const row = await getPromotionRow(rowId);
  if (!row || row.promotionId !== promotionId) {
    backToPromotion(promotionId, "That row could not be found.", "rows");
  }

  const moved = await movePromotionRow(rowId, direction);
  if (!moved) backToPromotion(promotionId, "That row cannot move any further.", "rows");

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "promotion.row.move",
    entity: "promotions",
    entityId: promotionId,
    before: rowSummary(row),
    after: { direction },
  });

  revalidatePath(`/admin/promotions/${promotionId}`);
  revalidatePath("/");
  backToPromotion(promotionId, undefined, "rows");
}

export async function deletePromotionRowAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const promotionId = String(formData.get("promotionId") ?? "").trim();
  const rowId = String(formData.get("rowId") ?? "").trim();
  if (!promotionId || !rowId) redirect("/admin/promotions");

  const row = await getPromotionRow(rowId);
  if (!row || row.promotionId !== promotionId) {
    backToPromotion(promotionId, "That row could not be found.", "rows");
  }

  const result = await deletePromotionRow(rowId);
  if (!result.ok) backToPromotion(promotionId, result.error, "rows");

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "promotion.row.delete",
    entity: "promotions",
    entityId: promotionId,
    before: rowSummary(row),
  });

  revalidatePath(`/admin/promotions/${promotionId}`);
  revalidatePath("/");
  backToPromotion(promotionId, undefined, "rows");
}

export async function addPromotionRowProductsAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const promotionId = String(formData.get("promotionId") ?? "").trim();
  const rowId = String(formData.get("rowId") ?? "").trim();
  if (!promotionId || !rowId) redirect("/admin/promotions");

  const row = await getPromotionRow(rowId);
  if (!row || row.promotionId !== promotionId) {
    backToPromotion(promotionId, "That row could not be found.", "rows");
  }

  const productIds = formData
    .getAll("productIds")
    .map((value) => String(value))
    .filter(Boolean);

  const result = await addPromotionRowProducts(rowId, productIds);
  if (!result.ok) backToPromotion(promotionId, result.error, "rows");

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "promotion.row.products.add",
    entity: "promotions",
    entityId: promotionId,
    after: { rowId, productIds, added: result.data.added },
  });

  revalidatePath(`/admin/promotions/${promotionId}`);
  revalidatePath("/");
  backToPromotion(promotionId, undefined, "rows");
}

export async function removePromotionRowProductAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const promotionId = String(formData.get("promotionId") ?? "").trim();
  const rowId = String(formData.get("rowId") ?? "").trim();
  const productId = String(formData.get("productId") ?? "").trim();
  if (!promotionId || !rowId || !productId) redirect("/admin/promotions");

  const row = await getPromotionRow(rowId);
  if (!row || row.promotionId !== promotionId) {
    backToPromotion(promotionId, "That row could not be found.", "rows");
  }

  const result = await removePromotionRowProduct(rowId, productId);
  if (!result.ok) backToPromotion(promotionId, result.error, "rows");

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "promotion.row.products.remove",
    entity: "promotions",
    entityId: promotionId,
    after: { rowId, productId },
  });

  revalidatePath(`/admin/promotions/${promotionId}`);
  revalidatePath("/");
  backToPromotion(promotionId, undefined, "rows");
}
