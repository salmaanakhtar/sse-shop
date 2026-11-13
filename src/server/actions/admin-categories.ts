"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { slugify } from "@/server/services/catalog";
import { requireAdminAction } from "../auth/guard";
import { db } from "../db/client";
import { auditLog, products } from "../db/schema";
import {
  createCategory,
  deleteCategory,
  getCategory,
  listProductCategoryIds,
  moveCategory,
  setProductCategories,
  updateCategory,
  type CategoryInput,
} from "../services/categories";

function backToNew(error?: string): never {
  redirect(`/admin/categories/new${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

function backToCategory(id: string, error?: string): never {
  redirect(`/admin/categories/${id}${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

function backToList(error?: string): never {
  redirect(`/admin/categories${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

function readCategory(formData: FormData): CategoryInput | string {
  const name = String(formData.get("name") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const parentRaw = String(formData.get("parentId") ?? "").trim();
  const slug = slugify(rawSlug || name);

  if (name.length < 2) return "Give the category a name.";
  if (name.length > 80) return "Keep the name under 80 characters.";
  if (!slug) return "Enter a URL slug using letters, numbers, or dashes.";
  if (description.length > 500) return "Keep the description under 500 characters.";

  return {
    name,
    slug,
    description,
    parentId: parentRaw || null,
    active: formData.get("active") === "on",
  };
}

function summary(category: {
  name: string;
  slug: string;
  parentId: string | null;
  active: boolean;
}) {
  return {
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
    active: category.active,
  };
}

export async function createCategoryAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const input = readCategory(formData);
  if (typeof input === "string") backToNew(input);

  const result = await createCategory(input);
  if (!result.ok) backToNew(result.error);

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "category.create",
    entity: "categories",
    entityId: result.data.id,
    after: summary(result.data),
  });

  revalidatePath("/");
  revalidatePath("/admin/categories");
  redirect("/admin/categories");
}

export async function updateCategoryAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) backToList();

  const before = await getCategory(id);
  if (!before) backToCategory(id, "That category could not be found.");

  const input = readCategory(formData);
  if (typeof input === "string") backToCategory(id, input);

  const result = await updateCategory(id, input);
  if (!result.ok) backToCategory(id, result.error);

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "category.update",
    entity: "categories",
    entityId: id,
    before: summary(before),
    after: summary(result.data),
  });

  revalidatePath("/");
  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${id}`);
  backToCategory(id);
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) backToList();

  const before = await getCategory(id);
  if (!before) backToList();

  const result = await deleteCategory(id);
  if (!result.ok) backToList(result.error);

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "category.delete",
    entity: "categories",
    entityId: id,
    before: summary(before),
  });

  revalidatePath("/");
  revalidatePath("/admin/categories");
  backToList();
}

export async function moveCategoryAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  const direction = formData.get("direction") === "up" ? "up" : "down";
  if (!id) backToList();

  const before = await getCategory(id);
  if (!before) backToList();

  const moved = await moveCategory(id, direction);
  if (!moved) backToList("That category cannot move any further.");

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "category.move",
    entity: "categories",
    entityId: id,
    before: { position: before.position },
    after: { direction },
  });

  revalidatePath("/");
  revalidatePath("/admin/categories");
  backToList();
}

export async function setProductCategoriesAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const productId = String(formData.get("productId") ?? "").trim();
  if (!productId) redirect("/admin/products");

  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) redirect("/admin/products");

  const categoryIds = formData
    .getAll("categoryIds")
    .map((value) => String(value))
    .filter(Boolean);

  const before = await listProductCategoryIds(productId);
  const result = await setProductCategories(productId, categoryIds);

  if (!result.ok) {
    redirect(
      `/admin/products/${productId}?error=${encodeURIComponent(result.error)}#categories`,
    );
  }

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "product.categories",
    entity: "products",
    entityId: productId,
    before: { categoryIds: before },
    after: { categoryIds: result.data.categoryIds },
  });

  revalidatePath("/");
  revalidatePath(`/admin/products/${productId}`);
  redirect(`/admin/products/${productId}#categories`);
}
