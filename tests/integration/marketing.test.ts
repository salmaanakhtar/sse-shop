import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db/client";
import {
  campaignSends,
  campaigns,
  emailSuppressions,
  subscribers,
  users,
} from "@/server/db/schema";
import { mailer } from "@/server/mail";
import { anonymizeCustomer } from "@/server/services/customers";
import {
  campaignSendStats,
  confirmNewsletterSubscription,
  countConfirmedSubscribers,
  createCampaign,
  getCampaign,
  processScheduledCampaigns,
  scheduleCampaign,
  sendCampaign,
  setMarketingConsent,
  subscribeToNewsletter,
  unsubscribeNewsletter,
} from "@/server/services/marketing";

const suffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function createUser() {
  const [user] = await db
    .insert(users)
    .values({ name: "Campaign Admin", email: `campaign-${suffix()}@example.com` })
    .returning();
  if (!user) throw new Error("could not create the test user");
  return user;
}

async function confirmedSubscriber(email: string, name = "Reader") {
  const result = await subscribeToNewsletter({ email, name });
  expect(result.ok).toBe(true);
  if (!result.ok || !result.data.confirmToken) throw new Error("missing confirmation token");
  expect(await confirmNewsletterSubscription(result.data.confirmToken)).toBe(true);
}

describe("marketing email", () => {
  beforeEach(async () => {
    await db.delete(campaignSends);
    await db.delete(campaigns);
    await db.delete(subscribers);
    await db.delete(emailSuppressions);
  });

  it("double opt-in confirms a subscriber once", async () => {
    const email = `reader-${suffix()}@example.com`;
    const pending = await subscribeToNewsletter({ email, name: "Reader" });
    expect(pending.ok).toBe(true);
    if (!pending.ok) return;
    expect(pending.data.status).toBe("pending");

    // A pending address is mailed again rather than treated as confirmed.
    const repeated = await subscribeToNewsletter({ email });
    expect(repeated.ok).toBe(true);
    if (!repeated.ok) return;
    expect(repeated.data.status).toBe("pending");

    expect(await confirmNewsletterSubscription(repeated.data.confirmToken!)).toBe(true);
    expect(await confirmNewsletterSubscription(repeated.data.confirmToken!)).toBe(false);
    expect(await countConfirmedSubscribers()).toBe(1);

    const again = await subscribeToNewsletter({ email });
    expect(again).toEqual({ ok: true, data: { status: "already_subscribed" } });
  });

  it("unsubscribes, suppresses, and allows a deliberate new opt-in", async () => {
    const email = `leaver-${suffix()}@example.com`;
    const pending = await subscribeToNewsletter({ email });
    if (!pending.ok) throw new Error("subscribe failed");
    await confirmNewsletterSubscription(pending.data.confirmToken!);

    expect(await unsubscribeNewsletter(pending.data.unsubscribeToken!)).toBe(true);
    expect(await countConfirmedSubscribers()).toBe(0);

    const [suppression] = await db
      .select()
      .from(emailSuppressions)
      .where(eq(emailSuppressions.email, email));
    expect(suppression?.reason).toBe("unsubscribe");

    const resubscribed = await subscribeToNewsletter({ email });
    expect(resubscribed.ok).toBe(true);
    if (!resubscribed.ok) return;
    expect(resubscribed.data.status).toBe("pending");
    expect(
      await db.select().from(emailSuppressions).where(eq(emailSuppressions.email, email)),
    ).toHaveLength(0);
  });

  it("keeps the account preference and subscriber row in step", async () => {
    const user = await createUser();

    expect((await setMarketingConsent(user.id, true)).ok).toBe(true);
    const [subscriber] = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, user.email));
    expect(subscriber?.status).toBe("subscribed");
    expect(await countConfirmedSubscribers()).toBe(1);

    expect((await setMarketingConsent(user.id, false)).ok).toBe(true);
    const [after] = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, user.email));
    expect(after?.status).toBe("unsubscribed");
    expect(
      await db.select().from(emailSuppressions).where(eq(emailSuppressions.email, user.email)),
    ).toHaveLength(1);
  });

  it("removes the subscriber and campaign history on account deletion", async () => {
    const user = await createUser();
    await setMarketingConsent(user.id, true);

    const admin = await createUser();
    const campaign = await createCampaign({
      subject: "Before deletion",
      body: "A campaign body that sends.",
      createdBy: admin.id,
    });
    if (!campaign.ok) throw new Error("could not create campaign");

    const send = vi.spyOn(mailer, "send").mockResolvedValue(undefined);
    await sendCampaign(campaign.data.id);
    send.mockRestore();

    expect(await anonymizeCustomer(user.id, admin.id)).toBe(true);
    expect(
      await db.select().from(subscribers).where(eq(subscribers.email, user.email)),
    ).toHaveLength(0);
    expect(
      await db.select().from(campaignSends).where(eq(campaignSends.email, user.email)),
    ).toHaveLength(0);
  });

  it("sends one personalized row per confirmed, unsuppressed subscriber", async () => {
    const admin = await createUser();
    const first = `first-${suffix()}@example.com`;
    const second = `second-${suffix()}@example.com`;
    await confirmedSubscriber(first, "Amina");
    await confirmedSubscriber(second, "Bilal");

    const [secondRow] = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, second));
    if (!secondRow) throw new Error("missing second subscriber");
    await unsubscribeNewsletter(secondRow.unsubscribeToken);

    const created = await createCampaign({
      subject: "Hello {name}",
      body: "New pieces are here, {name}.",
      createdBy: admin.id,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const send = vi.spyOn(mailer, "send").mockResolvedValue(undefined);
    const result = await sendCampaign(created.data.id);

    expect(result).toEqual({ ok: true, data: { sent: 1, failed: 0 } });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0].to).toBe(first);
    expect(send.mock.calls[0]?.[0].subject).toBe("Hello Amina");
    expect(send.mock.calls[0]?.[0].text).toContain("New pieces are here, Amina.");
    expect(send.mock.calls[0]?.[0].text).toContain("Unsubscribe: ");

    const campaign = await getCampaign(created.data.id);
    expect(campaign?.status).toBe("sent");
    expect(campaign?.recipientCount).toBe(1);
    expect(await campaignSendStats(created.data.id)).toEqual({ sent: 1, failed: 0 });

    const again = await sendCampaign(created.data.id);
    expect(again.ok).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);

    send.mockRestore();
  });

  it("processes only due scheduled campaigns", async () => {
    const admin = await createUser();
    await confirmedSubscriber(`due-${suffix()}@example.com`);

    const due = await createCampaign({
      subject: "Due now",
      body: "This should send.",
      createdBy: admin.id,
    });
    const later = await createCampaign({
      subject: "Later",
      body: "This should wait.",
      createdBy: admin.id,
    });
    if (!due.ok || !later.ok) throw new Error("could not create campaigns");

    await scheduleCampaign(due.data.id, new Date(Date.now() - 60_000));
    await scheduleCampaign(later.data.id, new Date(Date.now() + 86_400_000));

    const send = vi.spyOn(mailer, "send").mockResolvedValue(undefined);
    const result = await processScheduledCampaigns();

    expect(result.processed).toBe(1);
    expect(result.sent).toBe(1);
    expect((await getCampaign(due.data.id))?.status).toBe("sent");
    expect((await getCampaign(later.data.id))?.status).toBe("scheduled");

    send.mockRestore();
  });

  it("records a per-recipient outbox row", async () => {
    const admin = await createUser();
    await confirmedSubscriber(`outbox-${suffix()}@example.com`);
    const created = await createCampaign({
      subject: "Outbox",
      body: "Check the row.",
      createdBy: admin.id,
    });
    if (!created.ok) throw new Error("could not create campaign");

    const send = vi.spyOn(mailer, "send").mockResolvedValue(undefined);
    await sendCampaign(created.data.id);
    send.mockRestore();

    const rows = await db
      .select()
      .from(campaignSends)
      .where(eq(campaignSends.campaignId, created.data.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("sent");
    expect(rows[0]?.sentAt).toBeInstanceOf(Date);

    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, created.data.id));
    expect(campaign?.sentAt).toBeInstanceOf(Date);
  });
});
