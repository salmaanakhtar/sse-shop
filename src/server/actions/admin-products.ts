"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseDubaiDateTimeInput } from "@/lib/dates";
import { parseMoney } from "@/lib/money";
import { collectSubtreeVariantIds, flattenVariantTree } from "@/lib/variants";
import { requireAdminAction } from "../auth/guard";
import { db } from "../db/client";
import {
  auditLog,
  productMedia,
  productOptionValues,
  productOptions,
  products,
  variantNodes,
  variants,
} from "../db/schema";
import { storeProductImage, uploadsRoot } from "../media/storage";
import { slugify } from "../services/catalog";
import { processStockChanges } from "../services/notifications";
import {
  bulkUpdateVariantLeaves,
  copyVariantChildren,
  createDefaultVariant,
  createLeafVariant,
  createVariantBranches,
  deleteVariantNode,
  getVariantTree,
  updateVariantNode,
} from "../services/variant-tree";
import {
  checkWishlistPriceDropsForVariant,
  checkWishlistPriceDropsForVariants,
} from "../services/wishlists";

function backToProduct(productId: string, error?: string, anchor?: string): never {
  const query = error ? `?error=${encodeURIComponent(error)}` : "";
  const hash = anchor ? `#${anchor}` : "";
  redirect(`/admin/products/${productId}${query}${hash}`);
}

function requireText(value: FormDataEntryValue | null, label: string): string {
  const text = String(value ?? "").trim();
  if (text.length === 0) throw new Error(`${label} is required.`);
  return text;
}

function readOptionalMoney(formData: FormData, name: string): number | null | "invalid" {
  const raw = String(formData.get(name) ?? "").trim();
  if (raw === "") return null;
  return parseMoney(raw) ?? "invalid";
}

function readOptionalStock(formData: FormData, name: string): number | null | "invalid" {
  const raw = String(formData.get(name) ?? "").trim();
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : "invalid";
}

/** Variant weight in grams; blank means "unknown", which ships in the base band. */
function readOptionalWeight(formData: FormData, name: string): number | null | "invalid" {
  const raw = String(formData.get(name) ?? "").trim();
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= 1_000_000 ? value : "invalid";
}

export async function createProductAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();

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

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "product.create",
    entity: "products",
    entityId: created.id,
    after: { title, slug, status: "draft" },
  });

  revalidatePath("/admin/products");
  redirect(`/admin/products/${created.id}`);
}

export async function updateProductAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();

  const id = requireText(formData.get("id"), "Product id");
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) backToProduct(id, "Give the product a name", "details");

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

  if (clash && clash.id !== id) backToProduct(id, "That URL slug is already taken", "details");

  const [before] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!before) backToProduct(id, "That product could not be found.", "details");

  const description = String(formData.get("description") ?? "").trim();

  await db
    .update(products)
    .set({
      title,
      slug,
      description,
      status,
      publishedAt: status === "active" ? (before.publishedAt ?? new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id));

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "product.update",
    entity: "products",
    entityId: id,
    before: {
      title: before.title,
      slug: before.slug,
      description: before.description,
      status: before.status,
      publishedAt: before.publishedAt,
    },
    after: { title, slug, description, status, publishedAt: status === "active" ? (before.publishedAt ?? new Date()) : null },
  });

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  revalidatePath("/");
  revalidatePath(`/products/${slug}`);
  backToProduct(id, undefined, "details");
}

export async function addOptionAction(formData: FormData): Promise<void> {
  await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const name = String(formData.get("name") ?? "").trim();
  if (name.length === 0) backToProduct(productId, "Name the level", "options");

  const tree = await getVariantTree(productId);
  if (tree.length > 0) {
    backToProduct(productId, "Clear the variant tree before adding a level", "options");
  }

  const existing = await db
    .select({ id: productOptions.id, position: productOptions.position })
    .from(productOptions)
    .where(eq(productOptions.productId, productId));

  const nextPosition = existing.reduce((max, option) => Math.max(max, option.position), -1) + 1;

  await db
    .insert(productOptions)
    .values({ productId, name, position: nextPosition })
    .onConflictDoNothing();

  revalidatePath("/");
  backToProduct(productId, undefined, "options");
}

export async function moveOptionAction(formData: FormData): Promise<void> {
  await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const optionId = requireText(formData.get("optionId"), "Option id");
  const direction = formData.get("direction") === "up" ? "up" : "down";

  const tree = await getVariantTree(productId);
  if (tree.length > 0) {
    backToProduct(productId, "Clear the variant tree before reordering levels", "options");
  }

  await db.transaction(async (tx) => {
    const options = await tx
      .select()
      .from(productOptions)
      .where(eq(productOptions.productId, productId))
      .orderBy(asc(productOptions.position), asc(productOptions.createdAt));

    const index = options.findIndex((option) => option.id === optionId);
    if (index === -1) return;

    const swapIndex = direction === "up" ? index - 1 : index + 1;
    const current = options[index];
    const swap = options[swapIndex];
    if (!current || !swap) return;

    const reordered = [...options];
    reordered[index] = swap;
    reordered[swapIndex] = current;

    for (const [position, option] of reordered.entries()) {
      if (option.position !== position) {
        await tx
          .update(productOptions)
          .set({ position })
          .where(eq(productOptions.id, option.id));
      }
    }
  });

  revalidatePath("/");
  backToProduct(productId, undefined, "options");
}

export async function addOptionValueAction(formData: FormData): Promise<void> {
  await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const optionId = requireText(formData.get("optionId"), "Option id");
  const value = String(formData.get("value") ?? "").trim();
  if (value.length === 0) backToProduct(productId, "Enter a value", "options");

  const [option] = await db
    .select({ id: productOptions.id })
    .from(productOptions)
    .where(and(eq(productOptions.id, optionId), eq(productOptions.productId, productId)))
    .limit(1);

  if (!option) backToProduct(productId, "That level is not on this product", "options");

  const existing = await db
    .select({ id: productOptionValues.id, position: productOptionValues.position })
    .from(productOptionValues)
    .where(eq(productOptionValues.optionId, optionId));

  const nextPosition = existing.reduce((max, value) => Math.max(max, value.position), -1) + 1;

  await db
    .insert(productOptionValues)
    .values({ optionId, value, position: nextPosition })
    .onConflictDoNothing();

  revalidatePath("/");
  backToProduct(productId, undefined, "options");
}

async function deleteVariantSubtrees(
  productId: string,
  matches: (node: ReturnType<typeof flattenVariantTree>[number]) => boolean,
): Promise<void> {
  const tree = await getVariantTree(productId);
  const nodes = flattenVariantTree(tree);
  const variantIds = [
    ...new Set(
      nodes.filter(matches).flatMap((node) => collectSubtreeVariantIds(node)),
    ),
  ];

  if (variantIds.length > 0) {
    await db.delete(variants).where(inArray(variants.id, variantIds));
  }
}

export async function deleteOptionAction(formData: FormData): Promise<void> {
  await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const optionId = requireText(formData.get("optionId"), "Option id");

  await deleteVariantSubtrees(productId, (node) => node.optionId === optionId);

  await db
    .delete(productOptions)
    .where(and(eq(productOptions.id, optionId), eq(productOptions.productId, productId)));

  revalidatePath("/");
  backToProduct(productId, undefined, "options");
}

export async function deleteOptionValueAction(formData: FormData): Promise<void> {
  await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const valueId = requireText(formData.get("valueId"), "Value id");

  await deleteVariantSubtrees(productId, (node) => node.optionValueId === valueId);

  await db.delete(productOptionValues).where(eq(productOptionValues.id, valueId));

  revalidatePath("/");
  backToProduct(productId, undefined, "options");
}

export async function addVariantBranchesAction(formData: FormData): Promise<void> {
  await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const parentRaw = String(formData.get("parentId") ?? "").trim();
  const parentId = parentRaw || null;
  const optionValueIds = formData
    .getAll("optionValueIds")
    .map((value) => String(value))
    .filter(Boolean);

  const priceMinor = readOptionalMoney(formData, "price");
  if (priceMinor === "invalid") backToProduct(productId, "Enter a valid price", "variants");

  const stockQty = readOptionalStock(formData, "stock");
  if (stockQty === "invalid") backToProduct(productId, "Enter a valid stock count", "variants");

  const result = await createVariantBranches({
    productId,
    parentId,
    optionValueIds,
    priceMinor,
    stockQty,
  });

  if (!result.ok) backToProduct(productId, result.error, "variants");

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  backToProduct(productId, undefined, "variants");
}

export async function updateVariantNodeAction(formData: FormData): Promise<void> {
  await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const nodeId = requireText(formData.get("nodeId"), "Branch id");

  const defaultPriceMinor = readOptionalMoney(formData, "defaultPrice");
  if (defaultPriceMinor === "invalid") {
    backToProduct(productId, "Enter a valid default price", "variants");
  }

  const defaultStockQty = readOptionalStock(formData, "defaultStock");
  if (defaultStockQty === "invalid") {
    backToProduct(productId, "Enter a valid default stock count", "variants");
  }

  const result = await updateVariantNode({
    productId,
    nodeId,
    active: formData.get("active") === "on",
    defaultPriceMinor,
    defaultStockQty,
  });

  if (!result.ok) backToProduct(productId, result.error, "variants");

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  backToProduct(productId, undefined, "variants");
}

export async function deleteVariantNodeAction(formData: FormData): Promise<void> {
  await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const nodeId = requireText(formData.get("nodeId"), "Branch id");

  const result = await deleteVariantNode({ productId, nodeId });
  if (!result.ok) backToProduct(productId, result.error, "variants");

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  backToProduct(productId, undefined, "variants");
}

export async function copyVariantChildrenAction(formData: FormData): Promise<void> {
  await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const sourceNodeId = requireText(formData.get("sourceNodeId"), "Source branch");
  const targetNodeId = requireText(formData.get("targetNodeId"), "Target branch");

  const result = await copyVariantChildren({ productId, sourceNodeId, targetNodeId });
  if (!result.ok) backToProduct(productId, result.error, "variants");

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  backToProduct(productId, undefined, "variants");
}

export async function createLeafVariantAction(formData: FormData): Promise<void> {
  await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const nodeId = requireText(formData.get("nodeId"), "Branch id");
  const priceMinor = readOptionalMoney(formData, "price");
  const stockQty = readOptionalStock(formData, "stock");
  const weightGrams = readOptionalWeight(formData, "weightGrams");

  if (priceMinor === null || priceMinor === "invalid") {
    backToProduct(productId, "Enter a valid price", "variants");
  }
  if (stockQty === null || stockQty === "invalid") {
    backToProduct(productId, "Enter a valid stock count", "variants");
  }
  if (weightGrams === "invalid") {
    backToProduct(productId, "Enter a valid weight in grams", "variants");
  }

  const result = await createLeafVariant({
    productId,
    nodeId,
    priceMinor,
    stockQty,
    weightGrams,
    sku: String(formData.get("sku") ?? "").trim(),
  });

  if (!result.ok) backToProduct(productId, result.error, "variants");

  await processStockChanges([result.data.variantId]).catch((error) => {
    console.error("stock notifications failed", error);
  });

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  backToProduct(productId, undefined, "variants");
}

export async function createDefaultVariantAction(formData: FormData): Promise<void> {
  await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const priceMinor = readOptionalMoney(formData, "price");
  const stockQty = readOptionalStock(formData, "stock");
  const weightGrams = readOptionalWeight(formData, "weightGrams");

  if (priceMinor === null || priceMinor === "invalid") {
    backToProduct(productId, "Enter a valid price", "variants");
  }
  if (stockQty === null || stockQty === "invalid") {
    backToProduct(productId, "Enter a valid stock count", "variants");
  }
  if (weightGrams === "invalid") {
    backToProduct(productId, "Enter a valid weight in grams", "variants");
  }

  const result = await createDefaultVariant({
    productId,
    priceMinor,
    stockQty,
    weightGrams,
    sku: String(formData.get("sku") ?? "").trim(),
  });

  if (!result.ok) backToProduct(productId, result.error, "variants");

  await processStockChanges([result.data.variantId]).catch((error) => {
    console.error("stock notifications failed", error);
  });

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  backToProduct(productId, undefined, "variants");
}

export async function updateVariantAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const variantId = requireText(formData.get("variantId"), "Variant id");

  const price = parseMoney(String(formData.get("price") ?? ""));
  if (price === null) backToProduct(productId, "Enter a valid price", "variants");

  const stock = Number(formData.get("stock") ?? 0);
  if (!Number.isInteger(stock) || stock < 0) {
    backToProduct(productId, "Enter a valid stock count", "variants");
  }

  const weightGrams = readOptionalWeight(formData, "weightGrams");
  if (weightGrams === "invalid") {
    backToProduct(productId, "Enter a valid weight in grams", "variants");
  }

  const lowStockThreshold = readOptionalStock(formData, "lowStockThreshold");
  if (lowStockThreshold === "invalid") {
    backToProduct(productId, "Enter a valid low-stock threshold", "variants");
  }

  const sku = String(formData.get("sku") ?? "").trim();
  if (sku.length === 0) backToProduct(productId, "SKU is required", "variants");

  const title = String(formData.get("title") ?? "").trim();
  const active = formData.get("active") === "on";

  const [current] = await db
    .select()
    .from(variants)
    .where(and(eq(variants.id, variantId), eq(variants.productId, productId)))
    .limit(1);

  if (!current) backToProduct(productId, "That variant could not be found.", "variants");
  if (current.salePriceMinor !== null && price <= current.salePriceMinor) {
    backToProduct(
      productId,
      "The regular price must stay above the existing sale price.",
      "variants",
    );
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(variants)
        .set({
          priceMinor: price,
          stockQty: stock,
          weightGrams,
          lowStockThreshold,
          sku,
          title: title || "Default",
          active,
          updatedAt: new Date(),
        })
        .where(and(eq(variants.id, variantId), eq(variants.productId, productId)));

      await tx
        .update(variantNodes)
        .set({ active, updatedAt: new Date() })
        .where(
          and(eq(variantNodes.productId, productId), eq(variantNodes.variantId, variantId)),
        );
    });
  } catch (error) {
    console.error("updateVariantAction failed", error);
    backToProduct(productId, "Could not save the variant. Is the SKU unique?", "variants");
  }

  await checkWishlistPriceDropsForVariant(variantId).catch((error) => {
    console.error("wishlist price check failed", error);
  });

  await processStockChanges([variantId]).catch((error) => {
    console.error("stock notifications failed", error);
  });

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "variant.update",
    entity: "variants",
    entityId: variantId,
    before: {
      priceMinor: current.priceMinor,
      stockQty: current.stockQty,
      sku: current.sku,
      title: current.title,
      weightGrams: current.weightGrams,
      lowStockThreshold: current.lowStockThreshold,
      active: current.active,
    },
    after: {
      priceMinor: price,
      stockQty: stock,
      sku,
      title: title || "Default",
      weightGrams,
      lowStockThreshold,
      active,
    },
  });

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  backToProduct(productId, undefined, "variants");
}

export async function updateVariantSaleAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const variantId = requireText(formData.get("variantId"), "Variant id");

  const salePriceRaw = String(formData.get("salePrice") ?? "").trim();
  const salePriceMinor = salePriceRaw === "" ? null : parseMoney(salePriceRaw);
  if (salePriceRaw !== "" && salePriceMinor === null) {
    backToProduct(productId, "Enter a valid sale price", "variants");
  }

  let saleStartsAt = parseDubaiDateTimeInput(String(formData.get("saleStartsAt") ?? ""));
  if (saleStartsAt === "invalid") {
    backToProduct(productId, "Enter a valid sale start time", "variants");
  }

  let saleEndsAt = parseDubaiDateTimeInput(String(formData.get("saleEndsAt") ?? ""));
  if (saleEndsAt === "invalid") {
    backToProduct(productId, "Enter a valid sale end time", "variants");
  }

  if (salePriceMinor === null) {
    saleStartsAt = null;
    saleEndsAt = null;
  }

  if (saleStartsAt && saleEndsAt && saleStartsAt >= saleEndsAt) {
    backToProduct(productId, "The sale must end after it starts", "variants");
  }

  const [variant] = await db
    .select()
    .from(variants)
    .where(and(eq(variants.id, variantId), eq(variants.productId, productId)))
    .limit(1);

  if (!variant) backToProduct(productId, "That variant could not be found.", "variants");

  if (
    salePriceMinor !== null &&
    (salePriceMinor < 0 || salePriceMinor >= variant.priceMinor)
  ) {
    backToProduct(productId, "The sale price must be below the regular price", "variants");
  }

  const before = {
    salePriceMinor: variant.salePriceMinor,
    saleStartsAt: variant.saleStartsAt,
    saleEndsAt: variant.saleEndsAt,
  };
  const after = { salePriceMinor, saleStartsAt, saleEndsAt };

  await db.transaction(async (tx) => {
    await tx
      .update(variants)
      .set({
        salePriceMinor,
        saleStartsAt: saleStartsAt as Date | null,
        saleEndsAt: saleEndsAt as Date | null,
        updatedAt: new Date(),
      })
      .where(and(eq(variants.id, variantId), eq(variants.productId, productId)));

    await tx.insert(auditLog).values({
      actorUserId: session.user.id,
      action: "variant.sale",
      entity: "variants",
      entityId: variantId,
      before,
      after,
    });
  });

  await checkWishlistPriceDropsForVariant(variantId).catch((error) => {
    console.error("wishlist price check failed", error);
  });

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  backToProduct(productId, undefined, "variants");
}

export async function bulkUpdateVariantsAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const variantIds = formData
    .getAll("variantIds")
    .map((value) => String(value))
    .filter(Boolean);

  const priceMinor = readOptionalMoney(formData, "price");
  if (priceMinor === "invalid") backToProduct(productId, "Enter a valid price", "variants");

  const stockQty = readOptionalStock(formData, "stock");
  if (stockQty === "invalid") {
    backToProduct(productId, "Enter a valid stock count", "variants");
  }

  const before = await db
    .select({
      id: variants.id,
      priceMinor: variants.priceMinor,
      stockQty: variants.stockQty,
    })
    .from(variants)
    .where(and(eq(variants.productId, productId), inArray(variants.id, variantIds)));

  const result = await bulkUpdateVariantLeaves({
    productId,
    variantIds,
    priceMinor,
    stockQty,
  });

  if (!result.ok) backToProduct(productId, result.error, "variants");

  await checkWishlistPriceDropsForVariants(variantIds).catch((error) => {
    console.error("wishlist price check failed", error);
  });

  await processStockChanges(variantIds).catch((error) => {
    console.error("stock notifications failed", error);
  });

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "variant.bulk-update",
    entity: "products",
    entityId: productId,
    before: { variants: before },
    after: { variantIds, priceMinor, stockQty },
  });

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  backToProduct(productId, undefined, "variants");
}

export async function uploadNodeImageAction(formData: FormData): Promise<void> {
  await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const nodeId = requireText(formData.get("nodeId"), "Branch id");
  const file = formData.get("image");

  if (!(file instanceof File) || file.size === 0) {
    backToProduct(productId, "Choose an image file", "variants");
  }

  const [node] = await db
    .select()
    .from(variantNodes)
    .where(and(eq(variantNodes.id, nodeId), eq(variantNodes.productId, productId)))
    .limit(1);

  if (!node) backToProduct(productId, "That branch could not be found", "variants");

  let stored;
  try {
    stored = await storeProductImage(file);
  } catch (error) {
    backToProduct(
      productId,
      error instanceof Error ? error.message : "Upload failed",
      "variants",
    );
  }

  await db
    .update(variantNodes)
    .set({
      imageKey: stored.storageKey,
      imageAlt: String(formData.get("alt") ?? "").trim(),
      updatedAt: new Date(),
    })
    .where(eq(variantNodes.id, nodeId));

  if (node.imageKey && node.imageKey !== stored.storageKey) {
    await unlink(path.join(uploadsRoot(), node.imageKey)).catch(() => {
      // A missing file is already the desired state.
    });
  }

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  backToProduct(productId, undefined, "variants");
}

export async function deleteNodeImageAction(formData: FormData): Promise<void> {
  await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const nodeId = requireText(formData.get("nodeId"), "Branch id");

  const [node] = await db
    .select()
    .from(variantNodes)
    .where(and(eq(variantNodes.id, nodeId), eq(variantNodes.productId, productId)))
    .limit(1);

  if (node?.imageKey) {
    await db
      .update(variantNodes)
      .set({ imageKey: null, imageAlt: "", updatedAt: new Date() })
      .where(eq(variantNodes.id, nodeId));
    await unlink(path.join(uploadsRoot(), node.imageKey)).catch(() => {
      // A missing file is already the desired state.
    });
  }

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  backToProduct(productId, undefined, "variants");
}

export async function uploadImageAction(formData: FormData): Promise<void> {
  await requireAdminAction();

  const productId = requireText(formData.get("productId"), "Product id");
  const file = formData.get("image");

  if (!(file instanceof File) || file.size === 0) {
    backToProduct(productId, "Choose an image file", "images");
  }

  let stored;
  try {
    stored = await storeProductImage(file);
  } catch (error) {
    backToProduct(productId, error instanceof Error ? error.message : "Upload failed", "images");
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
  backToProduct(productId, undefined, "images");
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
  backToProduct(productId, undefined, "images");
}
