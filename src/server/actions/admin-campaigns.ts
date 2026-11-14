"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseDubaiDateTimeInput } from "@/lib/dates";
import { requireAdminAction } from "../auth/guard";
import { db } from "../db/client";
import { auditLog } from "../db/schema";
import {
  cancelCampaign,
  createCampaign,
  deleteCampaign,
  getCampaign,
  processScheduledCampaigns,
  scheduleCampaign,
  sendCampaign,
  updateCampaign,
} from "../services/marketing";

function backToList(error?: string): never {
  redirect(`/admin/campaigns${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

function backToCampaign(id: string, error?: string): never {
  redirect(`/admin/campaigns/${id}${error ? `?error=${encodeURIComponent(error)}` : "?saved=1"}`);
}

export async function createCampaignAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  const result = await createCampaign({ subject, body, createdBy: session.user.id });
  if (!result.ok) backToList(result.error);

  const scheduleRaw = String(formData.get("scheduledAt") ?? "").trim();
  if (scheduleRaw) {
    const scheduledAt = parseDubaiDateTimeInput(scheduleRaw);
    if (scheduledAt === "invalid" || scheduledAt === null) {
      backToCampaign(result.data.id, "Enter a valid send time.");
    }
    const scheduled = await scheduleCampaign(result.data.id, scheduledAt);
    if (!scheduled.ok) backToCampaign(result.data.id, scheduled.error);
  }

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "campaign.create",
    entity: "campaigns",
    entityId: result.data.id,
    after: { subject, scheduledAt: scheduleRaw || null },
  });

  revalidatePath("/admin/campaigns");
  redirect(`/admin/campaigns/${result.data.id}`);
}

export async function updateCampaignAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) backToList();

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  const before = await getCampaign(id);
  if (!before) backToList("That campaign could not be found.");

  const result = await updateCampaign(id, { subject, body });
  if (!result.ok) backToCampaign(id, result.error);

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "campaign.update",
    entity: "campaigns",
    entityId: id,
    before: { subject: before.subject, body: before.body },
    after: { subject, body },
  });

  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${id}`);
  backToCampaign(id);
}

export async function scheduleCampaignAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) backToList();

  const scheduledAt = parseDubaiDateTimeInput(String(formData.get("scheduledAt") ?? ""));
  if (scheduledAt === "invalid" || scheduledAt === null) {
    backToCampaign(id, "Choose a valid send time.");
  }

  const result = await scheduleCampaign(id, scheduledAt);
  if (!result.ok) backToCampaign(id, result.error);

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "campaign.schedule",
    entity: "campaigns",
    entityId: id,
    after: { scheduledAt },
  });

  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${id}`);
  backToCampaign(id);
}

export async function sendCampaignNowAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) backToList();

  const result = await sendCampaign(id);
  if (!result.ok) backToCampaign(id, result.error);

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "campaign.send",
    entity: "campaigns",
    entityId: id,
    after: result.data,
  });

  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${id}`);
  redirect(`/admin/campaigns/${id}?sent=${result.data.sent}&failed=${result.data.failed}`);
}

export async function cancelCampaignAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) backToList();

  await cancelCampaign(id);
  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "campaign.cancel",
    entity: "campaigns",
    entityId: id,
  });

  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${id}`);
  backToCampaign(id);
}

export async function deleteCampaignAction(formData: FormData): Promise<void> {
  const session = await requireAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) backToList();

  const result = await deleteCampaign(id);
  if (!result.ok) backToCampaign(id, result.error);

  await db.insert(auditLog).values({
    actorUserId: session.user.id,
    action: "campaign.delete",
    entity: "campaigns",
    entityId: id,
  });

  revalidatePath("/admin/campaigns");
  backToList();
}

export async function processScheduledCampaignsAction(): Promise<void> {
  await requireAdminAction();
  const result = await processScheduledCampaigns();
  revalidatePath("/admin/campaigns");
  redirect(`/admin/campaigns?processed=${result.processed}&sent=${result.sent}`);
}
