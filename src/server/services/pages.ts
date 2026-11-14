import { and, asc, eq } from "drizzle-orm";
import { fail, ok, type Result } from "@/lib/result";
import { db } from "../db/client";
import { pages } from "../db/schema";

export type PageRecord = typeof pages.$inferSelect;

export type PageInput = {
  slug: string;
  title: string;
  body: string;
  published: boolean;
  seoTitle: string;
  seoDescription: string;
};

export async function listPages(publishedOnly = false): Promise<PageRecord[]> {
  const query = db.select().from(pages);
  const rows = publishedOnly
    ? await query
        .where(eq(pages.published, true))
        .orderBy(asc(pages.title))
    : await query.orderBy(asc(pages.title));
  return rows;
}

export async function getPage(id: string): Promise<PageRecord | null> {
  const [row] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
  return row ?? null;
}

export async function getPageBySlug(slug: string): Promise<PageRecord | null> {
  const [row] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.slug, slug), eq(pages.published, true)))
    .limit(1);
  return row ?? null;
}

async function slugTaken(slug: string, exceptId?: string): Promise<boolean> {
  const [row] = await db.select({ id: pages.id }).from(pages).where(eq(pages.slug, slug)).limit(1);
  return Boolean(row && row.id !== exceptId);
}

export async function createPage(input: PageInput): Promise<Result<PageRecord>> {
  if (!input.slug) return fail("Enter a URL slug.");
  if (await slugTaken(input.slug)) return fail("That page URL is already in use.");

  const [created] = await db
    .insert(pages)
    .values(input)
    .returning();
  if (!created) return fail("Could not create the page.");
  return ok(created);
}

export async function updatePage(
  id: string,
  input: PageInput,
): Promise<Result<PageRecord>> {
  if (!input.slug) return fail("Enter a URL slug.");
  if (await slugTaken(input.slug, id)) return fail("That page URL is already in use.");

  const [updated] = await db
    .update(pages)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(pages.id, id))
    .returning();
  if (!updated) return fail("That page could not be found.");
  return ok(updated);
}

export async function deletePage(id: string): Promise<Result<{ deleted: true }>> {
  const [deleted] = await db.delete(pages).where(eq(pages.id, id)).returning({ id: pages.id });
  if (!deleted) return fail("That page could not be found.");
  return ok({ deleted: true });
}
