"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "../auth/guard";
import { db } from "../db/client";
import { auditLog } from "../db/schema";
import {
  createHomeSection,
  deleteHomeSection,
  getHomeSection,
  isHomeSectionKind,
  moveHomeSection,
  updateHomeSection,
  type HomeSectionInput,
} from "../services/home-sections";

function backToHome(error?: string): never {
  redirect(`/admin/home${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

function readInput(formData: FormData): HomeSectionInput | string {
  const kind = String(formData.get("kind") ?? "");
  if (!isHomeSectionKind(kind)) return "Choose a section type.";

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const active = formData.get("active") === "on";
  const config: Record<string, unknown> = {};

  if (kind === "collection" || kind === "category") {
    const sourceId = String(formData.get("sourceId") ?? "").trim();
    if (!sourceId) return "Choose a source.";
    config[kind === "collection" ? "collectionId" : "categoryId"] = sourceId;
  }

  if (kind === "products") {
    const productIds = formData
      .getAll("productIds")
      .map((value) => String(value))
      .filter(Boolean);
    if (productIds.length === 0) return "Choose at least one product.";
    config.productIds = [...new Set(productIds)];
  }

  if (["collection", "category", "products", "allProducts"].includes(kind)) {
    const limit = Number(formData.get("limit") ?? 8);
    if (!Number.isInteger(limit) || limit < 1 || limit > 24) {
      return "Choose a product limit between 1 and 24.";
    }
    config.limit = limit;
  }

  return { kind, title, body, config, active };
}

export async function createHomeSectionAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const input = readInput(formData);
  if (typeof input === "string") backToHome(input);

  const result = await createHomeSection(input);
  if (!result.ok) backToHome(result.error);

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "home.section.create",
    entity: "home_sections",
    entityId: result.data.id,
    after: input,
  });

  revalidatePath("/");
  revalidatePath("/", "layout");
  revalidatePath("/admin/home");
  backToHome();
}

export async function updateHomeSectionAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) backToHome();

  const before = await getHomeSection(id);
  if (!before) backToHome("That section could not be found.");

  const input = readInput(formData);
  if (typeof input === "string") backToHome(input);

  const result = await updateHomeSection(id, input);
  if (!result.ok) backToHome(result.error);

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "home.section.update",
    entity: "home_sections",
    entityId: id,
    before: {
      kind: before.kind,
      title: before.title,
      body: before.body,
      config: before.config,
      active: before.active,
    },
    after: input,
  });

  revalidatePath("/");
  revalidatePath("/", "layout");
  revalidatePath("/admin/home");
  backToHome();
}

export async function deleteHomeSectionAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) backToHome();

  const before = await getHomeSection(id);
  if (!before) backToHome("That section could not be found.");

  const result = await deleteHomeSection(id);
  if (!result.ok) backToHome(result.error);

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "home.section.delete",
    entity: "home_sections",
    entityId: id,
    before: {
      kind: before.kind,
      title: before.title,
      body: before.body,
      config: before.config,
      active: before.active,
    },
  });

  revalidatePath("/");
  revalidatePath("/", "layout");
  revalidatePath("/admin/home");
  backToHome();
}

export async function moveHomeSectionAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  const direction = formData.get("direction") === "up" ? "up" : "down";
  if (!id) backToHome();

  const before = await getHomeSection(id);
  if (!before) backToHome("That section could not be found.");

  const moved = await moveHomeSection(id, direction);
  if (!moved) backToHome("That section cannot move any further.");

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "home.section.move",
    entity: "home_sections",
    entityId: id,
    before: { position: before.position },
    after: { direction },
  });

  revalidatePath("/");
  revalidatePath("/", "layout");
  revalidatePath("/admin/home");
  backToHome();
}
