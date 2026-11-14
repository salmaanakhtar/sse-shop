"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "../auth/guard";
import { db } from "../db/client";
import { auditLog } from "../db/schema";
import { slugify } from "../services/catalog";
import {
  createPage,
  deletePage,
  getPage,
  updatePage,
  type PageInput,
} from "../services/pages";

function backToPages(error?: string): never {
  redirect(`/admin/pages${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

function backToPage(id: string, error?: string): never {
  redirect(`/admin/pages/${id}${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

function readInput(formData: FormData): PageInput | string {
  const title = String(formData.get("title") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const seoTitle = String(formData.get("seoTitle") ?? "").trim();
  const seoDescription = String(formData.get("seoDescription") ?? "").trim();
  const slug = slugify(rawSlug || title);

  if (title.length < 2) return "Give the page a title.";
  if (!slug) return "Enter a URL slug.";
  if (body.length === 0) return "Add the page content.";
  if (seoTitle.length > 120) return "Keep the SEO title under 120 characters.";
  if (seoDescription.length > 240) return "Keep the SEO description under 240 characters.";

  return {
    slug,
    title,
    body,
    published: formData.get("published") === "on",
    seoTitle,
    seoDescription,
  };
}

export async function createPageAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const input = readInput(formData);
  if (typeof input === "string") backToPages(input);

  const result = await createPage(input);
  if (!result.ok) backToPages(result.error);

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "page.create",
    entity: "pages",
    entityId: result.data.id,
    after: { slug: input.slug, title: input.title, published: input.published },
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/pages");
  redirect(`/admin/pages/${result.data.id}`);
}

export async function updatePageAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) backToPages();

  const before = await getPage(id);
  if (!before) backToPage(id, "That page could not be found.");

  const input = readInput(formData);
  if (typeof input === "string") backToPage(id, input);

  const result = await updatePage(id, input);
  if (!result.ok) backToPage(id, result.error);

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "page.update",
    entity: "pages",
    entityId: id,
    before: {
      slug: before.slug,
      title: before.title,
      published: before.published,
      seoTitle: before.seoTitle,
      seoDescription: before.seoDescription,
    },
    after: {
      slug: input.slug,
      title: input.title,
      published: input.published,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
    },
  });

  revalidatePath("/", "layout");
  revalidatePath(`/pages/${before.slug}`);
  revalidatePath(`/pages/${input.slug}`);
  revalidatePath("/admin/pages");
  revalidatePath(`/admin/pages/${id}`);
  backToPage(id);
}

export async function deletePageAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) backToPages();

  const before = await getPage(id);
  if (!before) backToPages();

  const result = await deletePage(id);
  if (!result.ok) backToPages(result.error);

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "page.delete",
    entity: "pages",
    entityId: id,
    before: { slug: before.slug, title: before.title, published: before.published },
  });

  revalidatePath("/", "layout");
  revalidatePath(`/pages/${before.slug}`);
  revalidatePath("/admin/pages");
  backToPages();
}
