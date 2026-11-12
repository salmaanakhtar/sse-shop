"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseMoney } from "@/lib/money";
import { requireAdminAction } from "../auth/guard";
import { db } from "../db/client";
import { productMedia, productOptionValues, productOptions, products, variants } from "../db/schema";
import { storeProductImage, uploadsRoot } from "../media/storage";
import { slugify } from "../services/catalog";
import { generateMissingVariants } from "../services/variants";

function backToProduct(productId: string, error?: string): never {
  const suffix = error ? `?error=${encodeURIComponent(error)}` : "";
  redirect(`/admin/products/${productId}${suffix}`);
}

function requireText(value: FormDataEntryValue | null, label: string): string {
  const text = String(value ?? "").trim();
  if (text.length === 0) throw new Error(`${label} is required.`);
  return text;
}

export async function createProductAction(formData: FormData): Promise<void> {
  await requireAdminAction();

  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) redirect("/admin/products/new?error=Give+the+product+a+name");

  const slugInput = String(formData.get("slug") ?? "").trim();
  const baseSlug = slugify(slugInput || title) || `product-${Date.now()}`;

  const [clash] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.slug, baseSlug))
    .limit(1);

  const slug = clash ? `${baseSlug}-${Math.random().toString(36).slice(2, 6)}` : baseSlug;

  const [created] = await db
    .insert(products)
    .values({
      title,
      slug,
      description: String(formData.get("description") ?? "").trim(),
      status: "draft",
    })
    .returning({ id: products.id });

  if (!created) redirect("/admin/products/new?error=Could+not+create+the+product");

  revalidatePath("/admin/products");
  redirect(`/admin/products/${created.id}`);
}

export async function updateProductAction(formData: FormData): Promise<void> {
  await requireAdminAction();

  const id = requireText(formData.get("id"), "Product id");
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) backToProduct(id, "Give the product a name");

  const slugInput = String(formData.get("slug") ?? "").trim();
  const slug = slugify(slugInput) || slugify(title);

  const statusValue = String(formData.get("status") ?? "draft");
  const status = ["draft", "active", "archived"].includes(statusValue)
    ? (statusValue as "draft" | "active" | "archived")
    : "draft";

  const [clash] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);

  if (clash && clash.id !== id) backToProduct(id, "That URL slug is already taken");

  await db
    .update(products)
    .set({
      title,
      slug,
      description: String(formData.get("description") ?? "").trim(),
      status,
      publishedAt:
        status === "active"
          ? ((
              await db
                .select({ publishedAt: products.publishedAt })
                .from(products)
                .where(eq(products.id, id))
                .limit(1)
            )[0]?.publishedAt ?? new Date())
          : null,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id));

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  revalidatePath("/");
  revalidatePath(`/products/${slug}`);
  backToProduct(id);
}

export async function addOptionAction(formData: FormData): Promise<void> {
  await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const name = String(formData.get("name") ?? "").trim();
  if (name.length === 0) backToProduct(productId, "Name the option");

  const existing = await db
    .select({ id: productOptions.id })
    .from(productOptions)
    .where(eq(productOptions.productId, productId));

  if (existing.length >= 3) backToProduct(productId, "Three options is the practical limit");

  await db
    .insert(productOptions)
    .values({ productId, name, position: existing.length })
    .onConflictDoNothing();

  backToProduct(productId);
}

export async function addOptionValueAction(formData: FormData): Promise<void> {
  await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const optionId = requireText(formData.get("optionId"), "Option id");
  const value = String(formData.get("value") ?? "").trim();
  if (value.length === 0) backToProduct(productId, "Enter a value");

  const [option] = await db
    .select({ id: productOptions.id })
    .from(productOptions)
    .where(and(eq(productOptions.id, optionId), eq(productOptions.productId, productId)))
    .limit(1);

  if (!option) backToProduct(productId, "That option is not on this product");

  const existing = await db
    .select({ id: productOptionValues.id })
    .from(productOptionValues)
    .where(eq(productOptionValues.optionId, optionId));

  await db
    .insert(productOptionValues)
    .values({ optionId, value, position: existing.length })
    .onConflictDoNothing();

  backToProduct(productId);
}

export async function deleteOptionAction(formData: FormData): Promise<void> {
  await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const optionId = requireText(formData.get("optionId"), "Option id");

  await db
    .delete(productOptions)
    .where(and(eq(productOptions.id, optionId), eq(productOptions.productId, productId)));

  backToProduct(productId);
}

export async function deleteOptionValueAction(formData: FormData): Promise<void> {
  await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const valueId = requireText(formData.get("valueId"), "Value id");

  await db.delete(productOptionValues).where(eq(productOptionValues.id, valueId));

  backToProduct(productId);
}

export async function generateVariantsAction(formData: FormData): Promise<void> {
  await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const price = parseMoney(String(formData.get("price") ?? ""));
  const stockRaw = Number(formData.get("stock") ?? 0);

  if (price === null) backToProduct(productId, "Enter a valid price");
  if (!Number.isInteger(stockRaw) || stockRaw < 0) backToProduct(productId, "Enter a valid stock count");

  let result;
  try {
    result = await generateMissingVariants({ productId, priceMinor: price, stockQty: stockRaw });
  } catch (error) {
    console.error("generateVariantsAction failed", error);
    backToProduct(
      productId,
      error instanceof Error ? error.message : "Could not generate variants",
    );
  }

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");

  if (!result.ok) backToProduct(productId, result.error);
  backToProduct(productId, result.created === 0 ? "No new variants to add" : undefined);
}

export async function updateVariantAction(formData: FormData): Promise<void> {
  await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const variantId = requireText(formData.get("variantId"), "Variant id");

  const price = parseMoney(String(formData.get("price") ?? ""));
  if (price === null) backToProduct(productId, "Enter a valid price");

  const stock = Number(formData.get("stock") ?? 0);
  if (!Number.isInteger(stock) || stock < 0) backToProduct(productId, "Enter a valid stock count");

  const sku = String(formData.get("sku") ?? "").trim();
  if (sku.length === 0) backToProduct(productId, "SKU is required");

  const title = String(formData.get("title") ?? "").trim();

  await db
    .update(variants)
    .set({
      priceMinor: price,
      stockQty: stock,
      sku,
      title: title || "Default",
      active: formData.get("active") === "on",
      updatedAt: new Date(),
    })
    .where(and(eq(variants.id, variantId), eq(variants.productId, productId)));

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  backToProduct(productId);
}

export async function uploadImageAction(formData: FormData): Promise<void> {
  await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const file = formData.get("image");

  if (!(file instanceof File) || file.size === 0) {
    backToProduct(productId, "Choose an image file");
  }

  let stored;
  try {
    stored = await storeProductImage(file);
  } catch (error) {
    backToProduct(productId, error instanceof Error ? error.message : "Upload failed");
  }

  const existing = await db
    .select({ id: productMedia.id })
    .from(productMedia)
    .where(eq(productMedia.productId, productId));

  await db.insert(productMedia).values({
    productId,
    storageKey: stored.storageKey,
    alt: String(formData.get("alt") ?? "").trim(),
    width: stored.width,
    height: stored.height,
    position: existing.length,
  });

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  backToProduct(productId);
}

export async function deleteImageAction(formData: FormData): Promise<void> {
  await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const mediaId = requireText(formData.get("mediaId"), "Image id");

  const [media] = await db
    .select()
    .from(productMedia)
    .where(and(eq(productMedia.id, mediaId), eq(productMedia.productId, productId)))
    .limit(1);

  if (media) {
    await db.delete(productMedia).where(eq(productMedia.id, mediaId));
    await unlink(path.join(uploadsRoot(), media.storageKey)).catch(() => {
      // A missing file is already the desired state.
    });
  }

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  backToProduct(productId);
}
