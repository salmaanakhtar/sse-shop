import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { fail, ok, type Result } from "@/lib/result";
import { db } from "../db/client";
import {
  campaignSends,
  campaigns,
  emailSuppressions,
  subscribers,
  users,
} from "../db/schema";
import { mailer } from "../mail";
import { getStoreSettings } from "./settings";

const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

const storeUrl = () => process.env.NEXT_PUBLIC_STORE_URL ?? "http://localhost:3000";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

function unsubscribeUrl(token: string): string {
  return `${storeUrl()}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

function renderBody(
  text: string,
  subscriber: { name: string; email: string; unsubscribeToken: string },
): string {
  return text
    .replaceAll("{name}", subscriber.name || "there")
    .replaceAll("{email}", subscriber.email)
    .replaceAll("{unsubscribe_url}", unsubscribeUrl(subscriber.unsubscribeToken));
}

export type SubscribeResult = {
  status: "pending" | "already_subscribed";
  confirmToken?: string;
  unsubscribeToken?: string;
};

/**
 * Double opt-in. A brand-new or returning address becomes `pending` and the
 * caller sends the confirmation link; an already-confirmed address is left
 * alone rather than mailed again. The raw tokens never touch the database.
 */
export async function subscribeToNewsletter(input: {
  email: string;
  name?: string;
  source?: string;
}): Promise<Result<SubscribeResult>> {
  const email = emailSchema.safeParse(input.email);
  if (!email.success) {
    return fail(email.error.issues[0]?.message ?? "Enter a valid email address.");
  }

  const [existing] = await db
    .select()
    .from(subscribers)
    .where(eq(subscribers.email, email.data))
    .limit(1);

  if (existing?.status === "subscribed") {
    return ok({ status: "already_subscribed" });
  }

  const confirmToken = newToken();
  const unsubscribeToken = existing?.unsubscribeToken ?? newToken();

  await db
    .insert(subscribers)
    .values({
      email: email.data,
      name: input.name?.trim().slice(0, 120) ?? "",
      status: "pending",
      source: input.source ?? "newsletter",
      confirmTokenHash: hashToken(confirmToken),
      unsubscribeToken,
      consentAt: new Date(),
    })
    .onConflictDoUpdate({
      target: subscribers.email,
      set: {
        name: input.name?.trim().slice(0, 120) ?? "",
        status: "pending",
        source: input.source ?? "newsletter",
        confirmTokenHash: hashToken(confirmToken),
        unsubscribeToken,
        consentAt: new Date(),
        confirmedAt: null,
        unsubscribedAt: null,
        updatedAt: new Date(),
      },
    });

  // A deliberate new opt-in clears an old unsubscribe or manual suppression.
  await db.delete(emailSuppressions).where(eq(emailSuppressions.email, email.data));

  return ok({ status: "pending", confirmToken, unsubscribeToken });
}

export async function sendNewsletterConfirmation(input: {
  email: string;
  confirmToken: string;
  unsubscribeToken: string;
}): Promise<void> {
  const settings = await getStoreSettings();
  const link = `${storeUrl()}/newsletter/confirm?token=${encodeURIComponent(input.confirmToken)}`;

  await mailer.send({
    to: input.email,
    subject: `Confirm your ${settings.name} newsletter subscription`,
    text: [
      `One click to confirm:`,
      ``,
      link,
      ``,
      `If you did not ask for this, ignore the email and nothing else happens.`,
      `You can unsubscribe at any time: ${unsubscribeUrl(input.unsubscribeToken)}`,
    ].join("\n"),
  });
}

export async function confirmNewsletterSubscription(token: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(subscribers)
    .where(eq(subscribers.confirmTokenHash, hashToken(token)))
    .limit(1);
  if (!row || row.status !== "pending") return false;

  await db
    .update(subscribers)
    .set({
      status: "subscribed",
      confirmedAt: new Date(),
      consentAt: row.consentAt ?? new Date(),
      confirmTokenHash: null,
      updatedAt: new Date(),
    })
    .where(eq(subscribers.id, row.id));

  return true;
}

export async function unsubscribeNewsletter(token: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(subscribers)
    .where(eq(subscribers.unsubscribeToken, token))
    .limit(1);
  if (!row) return false;

  await db
    .update(subscribers)
    .set({ status: "unsubscribed", unsubscribedAt: new Date(), updatedAt: new Date() })
    .where(eq(subscribers.id, row.id));

  await db
    .insert(emailSuppressions)
    .values({ email: row.email, reason: "unsubscribe" })
    .onConflictDoUpdate({
      target: emailSuppressions.email,
      set: { reason: "unsubscribe" },
    });

  return true;
}

/** Account-level opt-in is explicit, so it is confirmed immediately. */
export async function setMarketingConsent(
  userId: string,
  consent: boolean,
): Promise<Result<{ consent: boolean }>> {
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return fail("That account could not be found.");

  await db
    .update(users)
    .set({
      marketingConsent: consent,
      marketingConsentAt: consent ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  if (consent) {
    await db
      .insert(subscribers)
      .values({
        email: user.email,
        name: user.name,
        status: "subscribed",
        source: "account",
        unsubscribeToken: newToken(),
        consentAt: new Date(),
        confirmedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: subscribers.email,
        set: {
          name: user.name,
          status: "subscribed",
          source: "account",
          consentAt: new Date(),
          confirmedAt: new Date(),
          unsubscribedAt: null,
          updatedAt: new Date(),
        },
      });

    await db.delete(emailSuppressions).where(eq(emailSuppressions.email, user.email));
  } else {
    await db
      .update(subscribers)
      .set({ status: "unsubscribed", unsubscribedAt: new Date(), updatedAt: new Date() })
      .where(eq(subscribers.email, user.email));

    await db
      .insert(emailSuppressions)
      .values({ email: user.email, reason: "unsubscribe" })
      .onConflictDoUpdate({
        target: emailSuppressions.email,
        set: { reason: "unsubscribe" },
      });
  }

  return ok({ consent });
}

export type CampaignRow = typeof campaigns.$inferSelect;

export async function listCampaigns(): Promise<CampaignRow[]> {
  return db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
}

export async function getCampaign(id: string): Promise<CampaignRow | null> {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return row ?? null;
}

function validateCampaign(input: { subject: string; body: string }): string | null {
  if (input.subject.trim().length < 2) return "Enter a subject.";
  if (input.subject.length > 160) return "Keep the subject under 160 characters.";
  if (input.body.trim().length < 10) return "Write the email body.";
  if (input.body.length > 20_000) return "Keep the email body under 20,000 characters.";
  return null;
}

export async function createCampaign(input: {
  subject: string;
  body: string;
  createdBy: string;
}): Promise<Result<{ id: string }>> {
  const invalid = validateCampaign(input);
  if (invalid) return fail(invalid);

  const [row] = await db
    .insert(campaigns)
    .values({
      subject: input.subject.trim(),
      body: input.body.trim(),
      status: "draft",
      createdBy: input.createdBy,
    })
    .returning({ id: campaigns.id });

  if (!row) return fail("Could not create the campaign.");
  return ok(row);
}

export async function updateCampaign(
  id: string,
  input: { subject: string; body: string },
): Promise<Result<{ id: string }>> {
  const invalid = validateCampaign(input);
  if (invalid) return fail(invalid);

  const [current] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  if (!current) return fail("That campaign could not be found.");
  if (current.status !== "draft") return fail("Only a draft campaign can be edited.");

  await db
    .update(campaigns)
    .set({ subject: input.subject.trim(), body: input.body.trim(), updatedAt: new Date() })
    .where(eq(campaigns.id, id));

  return ok({ id });
}

export async function scheduleCampaign(
  id: string,
  scheduledAt: Date,
): Promise<Result<{ id: string }>> {
  if (Number.isNaN(scheduledAt.getTime())) return fail("Choose a valid send time.");
  const [current] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  if (!current) return fail("That campaign could not be found.");
  if (current.status !== "draft" && current.status !== "scheduled") {
    return fail("This campaign cannot be scheduled.");
  }

  await db
    .update(campaigns)
    .set({ status: "scheduled", scheduledAt, updatedAt: new Date() })
    .where(eq(campaigns.id, id));
  return ok({ id });
}

export async function cancelCampaign(id: string): Promise<Result<{ id: string }>> {
  await db
    .update(campaigns)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(campaigns.id, id), eq(campaigns.status, "scheduled")));
  return ok({ id });
}

export async function deleteCampaign(id: string): Promise<Result<{ deleted: true }>> {
  const [row] = await db
    .delete(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.status, "draft")))
    .returning({ id: campaigns.id });
  if (!row) return fail("Only a draft campaign can be deleted.");
  return ok({ deleted: true });
}

export async function countConfirmedSubscribers(): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(subscribers)
    .where(eq(subscribers.status, "subscribed"));
  return row?.value ?? 0;
}

/**
 * Sends to every confirmed subscriber that is not suppressed. Each recipient
 * gets one outbox row, so re-running a campaign cannot double-send. Failures
 * are recorded per recipient and do not stop the rest.
 */
export async function sendCampaign(
  id: string,
): Promise<Result<{ sent: number; failed: number }>> {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  if (!campaign) return fail("That campaign could not be found.");
  if (campaign.status === "sent") return fail("This campaign has already been sent.");
  if (campaign.status === "cancelled") return fail("This campaign was cancelled.");

  const settings = await getStoreSettings();

  await db
    .update(campaigns)
    .set({ status: "sending", updatedAt: new Date() })
    .where(eq(campaigns.id, id));

  const recipients = await db
    .select({
      id: subscribers.id,
      email: subscribers.email,
      name: subscribers.name,
      unsubscribeToken: subscribers.unsubscribeToken,
    })
    .from(subscribers)
    .leftJoin(emailSuppressions, eq(emailSuppressions.email, subscribers.email))
    .where(and(eq(subscribers.status, "subscribed"), isNull(emailSuppressions.email)));

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const [queued] = await db
      .insert(campaignSends)
      .values({ campaignId: id, subscriberId: recipient.id, email: recipient.email })
      .onConflictDoNothing()
      .returning({ id: campaignSends.id });
    if (!queued) continue;

    try {
      await mailer.send({
        to: recipient.email,
        subject: renderBody(campaign.subject, recipient),
        text: [
          renderBody(campaign.body, recipient),
          ``,
          `— ${settings.name}`,
          ``,
          `Unsubscribe: ${unsubscribeUrl(recipient.unsubscribeToken)}`,
        ].join("\n"),
      });
      await db
        .update(campaignSends)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(campaignSends.id, queued.id));
      sent += 1;
    } catch (error) {
      failed += 1;
      await db
        .update(campaignSends)
        .set({ status: "failed", error: String(error).slice(0, 500) })
        .where(eq(campaignSends.id, queued.id));
      console.error("campaign mail failed", error);
    }
  }

  await db
    .update(campaigns)
    .set({
      status: "sent",
      sentAt: new Date(),
      recipientCount: sent,
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, id));

  return ok({ sent, failed });
}

export async function campaignSendStats(
  campaignId: string,
): Promise<{ sent: number; failed: number }> {
  const rows = await db
    .select({ status: campaignSends.status, value: sql<number>`count(*)::int` })
    .from(campaignSends)
    .where(eq(campaignSends.campaignId, campaignId))
    .groupBy(campaignSends.status);

  const byStatus = new Map(rows.map((row) => [row.status, row.value]));
  return { sent: byStatus.get("sent") ?? 0, failed: byStatus.get("failed") ?? 0 };
}

export async function processScheduledCampaigns(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const due = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.status, "scheduled"), lte(campaigns.scheduledAt, new Date())));

  let sent = 0;
  let failed = 0;

  for (const campaign of due) {
    const result = await sendCampaign(campaign.id);
    if (result.ok) {
      sent += result.data.sent;
      failed += result.data.failed;
    }
  }

  return { processed: due.length, sent, failed };
}
