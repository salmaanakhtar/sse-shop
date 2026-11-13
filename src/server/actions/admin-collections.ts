"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { slugify } from "@/server/services/catalog";
import { requireAdminAction } from "../auth/guard";
import { db } from "../db/client";
import { auditLog } from "../db/schema";
import {
  addCollectionProduct,
  createCollection,
  deleteCollection,
  getCollection,
  listCollectionProductIds,
  moveCollection,
  moveCollectionProduct,
  removeCollectionProduct,
  updateCollection,
  type CollectionInput,
} from "../services/collections";

function backToNew(error?: string): never {
  redirect(`/admin/collections/new${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

function backToCollection(id: string, error?: string, anchor = ""): never {
  const query = error ? `?error=${encodeURIComponent(error)}` : "";
  const hash = anchor ? `#${anchor}` : "";
  redirect(`/admin/collections/${id}${query}${hash}`);
}

function backToList(error?: string): never {
  redirect(`/admin/collections${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

function readCollection(formData: FormData): CollectionInput | string {
  const name = String(formData.get("name") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const slug = slugify(rawSlug || name);

  if (name.length < 2) return "Give the collection a name.";
  if (name.length > 80) return "Keep the name under 80 characters.";
  if (!slug) return "Enter a URL slug using letters, numbers, or dashes.";
  if (description.length > 500) return "Keep the description under 500 characters.";

  return {
    name,
    slug,
    description,
    active: formData.get("active") === "on",
  };
}

function summary(collection: {
  name: string;
  slug: string;
  active: boolean;
}) {
  return {
    name: collection.name,
    slug: collection.slug,
    active: collection.active,
  };
}

export async function createCollectionAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const input = readCollection(formData);
  if (typeof input === "string") backToNew(input);

  const result = await createCollection(input);
  if (!result.ok) backToNew(result.error);

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "collection.create",
    entity: "collections",
    entityId: result.data.id,
    after: summary(result.data),
  });

  revalidatePath("/");
  revalidatePath("/admin/collections");
  redirect(`/admin/collections/${result.data.id}`);
}

export async function updateCollectionAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) backToList();

  const before = await getCollection(id);
  if (!before) backToCollection(id, "That collection could not be found.");

  const input = readCollection(formData);
  if (typeof input === "string") backToCollection(id, input);

  const result = await updateCollection(id, input);
  if (!result.ok) backToCollection(id, result.error);

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "collection.update",
    entity: "collections",
    entityId: id,
    before: summary(before),
    after: summary(result.data),
  });

  revalidatePath("/");
  revalidatePath("/admin/collections");
  revalidatePath(`/admin/collections/${id}`);
  backToCollection(id);
}

export async function deleteCollectionAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) backToList();

  const before = await getCollection(id);
  if (!before) backToList();

  const result = await deleteCollection(id);
  if (!result.ok) backToList(result.error);

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "collection.delete",
    entity: "collections",
    entityId: id,
    before: summary(before),
  });

  revalidatePath("/");
  revalidatePath("/admin/collections");
  backToList();
}

export async function moveCollectionAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  const direction = formData.get("direction") === "up" ? "up" : "down";
  if (!id) backToList();

  const before = await getCollection(id);
  if (!before) backToList();

  const moved = await moveCollection(id, direction);
  if (!moved) backToList("That collection cannot move any further.");

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "collection.move",
    entity: "collections",
    entityId: id,
    before: { position: before.position },
    after: { direction },
  });

  revalidatePath("/");
  revalidatePath("/admin/collections");
  backToList();
}

export async function addCollectionProductAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const collectionId = String(formData.get("collectionId") ?? "").trim();
  const productId = String(formData.get("productId") ?? "").trim();
  if (!collectionId) backToList();
  if (!productId) backToCollection(collectionId, "Choose a product.", "products");

  const before = await listCollectionProductIds(collectionId);
  const result = await addCollectionProduct(collectionId, productId);
  if (!result.ok) backToCollection(collectionId, result.error, "products");

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "collection.product.add",
    entity: "collections",
    entityId: collectionId,
    before: { productIds: before },
    after: { productIds: [...before, productId] },
  });

  revalidatePath("/");
  revalidatePath(`/admin/collections/${collectionId}`);
  backToCollection(collectionId, undefined, "products");
}

export async function removeCollectionProductAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const collectionId = String(formData.get("collectionId") ?? "").trim();
  const productId = String(formData.get("productId") ?? "").trim();
  if (!collectionId || !productId) backToCollection(collectionId, undefined, "products");

  const before = await listCollectionProductIds(collectionId);
  const result = await removeCollectionProduct(collectionId, productId);
  if (!result.ok) backToCollection(collectionId, result.error, "products");

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "collection.product.remove",
    entity: "collections",
    entityId: collectionId,
    before: { productIds: before },
    after: { productIds: before.filter((id) => id !== productId) },
  });

  revalidatePath("/");
  revalidatePath(`/admin/collections/${collectionId}`);
  backToCollection(collectionId, undefined, "products");
}

export async function moveCollectionProductAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const collectionId = String(formData.get("collectionId") ?? "").trim();
  const productId = String(formData.get("productId") ?? "").trim();
  const direction = formData.get("direction") === "up" ? "up" : "down";
  if (!collectionId || !productId) backToCollection(collectionId, undefined, "products");

  const moved = await moveCollectionProduct(collectionId, productId, direction);
  if (!moved) backToCollection(collectionId, "That product cannot move any further.", "products");

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "collection.product.move",
    entity: "collections",
    entityId: collectionId,
    before: { productId, direction },
  });

  revalidatePath("/");
  revalidatePath(`/admin/collections/${collectionId}`);
  backToCollection(collectionId, undefined, "products");
}
