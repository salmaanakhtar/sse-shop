import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Button, buttonClass } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import {
  cancelCampaignAction,
  deleteCampaignAction,
  scheduleCampaignAction,
  sendCampaignNowAction,
  updateCampaignAction,
} from "@/server/actions/admin-campaigns";
import { formatDubaiDateTimeInput } from "@/lib/dates";
import { requireAdminPage } from "@/server/auth/guard";
import { campaignSendStats, getCampaign } from "@/server/services/marketing";

export const metadata = { title: "Campaign" };

export default async function AdminCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; sent?: string; failed?: string }>;
}) {
  await requireAdminPage();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  const stats = await campaignSendStats(id);
  const editable = campaign.status === "draft";
  const sendable = campaign.status === "draft" || campaign.status === "scheduled";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">
            {campaign.status}
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{campaign.subject}</h1>
          <p className="mt-1 text-xs text-muted">
            {campaign.scheduledAt
              ? `Scheduled ${campaign.scheduledAt.toLocaleString("en-AE")}`
              : campaign.sentAt
                ? `Sent ${campaign.sentAt.toLocaleString("en-AE")}`
                : "Draft"}
          </p>
        </div>
        <Link href="/admin/campaigns" className="text-sm text-muted hover:text-ink">
          All campaigns
        </Link>
      </div>

      {query.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {query.error}
        </p>
      ) : null}
      {query.saved ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Campaign saved.
        </p>
      ) : null}
      {query.sent !== undefined ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Sent {query.sent} emails{Number(query.failed) > 0 ? `; ${query.failed} failed` : ""}.
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Recipients</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{campaign.recipientCount}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Sent rows</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{stats.sent}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Failed rows</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{stats.failed}</p>
        </div>
      </section>

      {editable ? (
        <form
          action={updateCampaignAction}
          className="space-y-4 rounded-xl border border-line bg-surface p-6"
        >
          <input type="hidden" name="id" value={campaign.id} />
          <div>
            <Label htmlFor="campaign-subject">Subject</Label>
            <Input
              id="campaign-subject"
              name="subject"
              required
              maxLength={160}
              defaultValue={campaign.subject}
            />
          </div>
          <div>
            <Label htmlFor="campaign-body">Body</Label>
            <Textarea
              id="campaign-body"
              name="body"
              rows={14}
              required
              maxLength={20_000}
              defaultValue={campaign.body}
            />
          </div>
          <Button type="submit">Save draft</Button>
        </form>
      ) : (
        <section className="rounded-xl border border-line bg-surface p-6">
          <h2 className="text-sm font-semibold">Body</h2>
          <pre className="mt-3 whitespace-pre-wrap text-sm text-muted">{campaign.body}</pre>
        </section>
      )}

      {sendable ? (
        <section className="rounded-xl border border-line bg-surface p-6">
          <h2 className="text-sm font-semibold">Send</h2>
          <p className="mt-2 text-sm text-muted">
            Sending uses every confirmed subscriber that is not suppressed. Each recipient gets one
            outbox row, so a retry can never double-send.
          </p>

          <form action={scheduleCampaignAction} className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={campaign.id} />
            <div className="w-64">
              <Label htmlFor="campaign-schedule">Schedule</Label>
              <Input
                id="campaign-schedule"
                name="scheduledAt"
                type="datetime-local"
                defaultValue={formatDubaiDateTimeInput(campaign.scheduledAt)}
              />
            </div>
            <Button type="submit" size="sm" variant="secondary">
              Save schedule
            </Button>
          </form>

          <form action={sendCampaignNowAction} className="mt-4">
            <input type="hidden" name="id" value={campaign.id} />
            <ConfirmSubmitButton
              type="submit"
              message="Send this campaign now?"
              className={buttonClass("primary", "sm")}
            >
              Send now
            </ConfirmSubmitButton>
          </form>
        </section>
      ) : null}

      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-5">
        {campaign.status === "scheduled" ? (
          <form action={cancelCampaignAction}>
            <input type="hidden" name="id" value={campaign.id} />
            <ConfirmSubmitButton
              type="submit"
              message="Cancel this scheduled campaign?"
              className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-ink"
            >
              Cancel schedule
            </ConfirmSubmitButton>
          </form>
        ) : null}
        {campaign.status === "draft" ? (
          <form action={deleteCampaignAction}>
            <input type="hidden" name="id" value={campaign.id} />
            <ConfirmSubmitButton
              type="submit"
              message="Delete this draft?"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
            >
              Delete draft
            </ConfirmSubmitButton>
          </form>
        ) : null}
      </section>
    </div>
  );
}
