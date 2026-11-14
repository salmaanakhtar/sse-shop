import Link from "next/link";
import { buttonClass, Button } from "@/components/ui/button";
import {
  processScheduledCampaignsAction,
} from "@/server/actions/admin-campaigns";
import { requireAdminPage } from "@/server/auth/guard";
import {
  countConfirmedSubscribers,
  listCampaigns,
} from "@/server/services/marketing";

export const metadata = { title: "Campaigns" };

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  scheduled: "bg-sky-50 text-sky-700",
  sending: "bg-amber-50 text-amber-700",
  sent: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-700",
};

export default async function AdminCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; processed?: string; sent?: string }>;
}) {
  await requireAdminPage();
  const [{ error, processed, sent }, campaigns, subscriberCount] = await Promise.all([
    searchParams,
    listCampaigns(),
    countConfirmedSubscribers(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Campaigns</h1>
          <p className="mt-1 text-sm text-muted">
            {subscriberCount} confirmed {subscriberCount === 1 ? "subscriber" : "subscribers"}.
            Campaigns send through the console mailer until the deploy-ready phase.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={processScheduledCampaignsAction}>
            <Button type="submit" size="sm" variant="secondary">
              Process scheduled
            </Button>
          </form>
          <Link href="/admin/campaigns/new" className={buttonClass("primary", "sm")}>
            New campaign
          </Link>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {processed !== undefined ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Processed {processed} scheduled {processed === "1" ? "campaign" : "campaigns"}; sent{" "}
          {sent ?? "0"} emails.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {campaigns.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted">
            No campaigns yet. Write one and schedule it, or send it now.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">Subject</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">When</th>
                <th className="px-5 py-3 text-right font-semibold">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-page/60">
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/campaigns/${campaign.id}`}
                      className="font-medium hover:text-brand"
                    >
                      {campaign.subject}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[campaign.status] ?? ""}`}
                    >
                      {campaign.status}
                    </span>
                  </td>
                  <td className="hidden px-5 py-3 text-xs text-muted sm:table-cell">
                    {campaign.sentAt
                      ? campaign.sentAt.toLocaleString("en-AE")
                      : campaign.scheduledAt
                        ? campaign.scheduledAt.toLocaleString("en-AE")
                        : "—"}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {campaign.recipientCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
