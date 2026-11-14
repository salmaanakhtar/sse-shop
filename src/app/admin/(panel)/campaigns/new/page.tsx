import Link from "next/link";
import { createCampaignAction } from "@/server/actions/admin-campaigns";
import { requireAdminPage } from "@/server/auth/guard";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";

export const metadata = { title: "New campaign" };

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">New campaign</h1>
          <p className="mt-1 text-sm text-muted">
            Plain-text email. Use {"{name}"} and {"{unsubscribe_url}"} as placeholders.
          </p>
        </div>
        <Link href="/admin/campaigns" className="text-sm text-muted hover:text-ink">
          Cancel
        </Link>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <form action={createCampaignAction} className="space-y-5 rounded-xl border border-line bg-surface p-6">
        <div>
          <Label htmlFor="campaign-subject">Subject</Label>
          <Input id="campaign-subject" name="subject" required maxLength={160} />
        </div>
        <div>
          <Label htmlFor="campaign-body">Body</Label>
          <Textarea id="campaign-body" name="body" rows={14} required maxLength={20_000} />
          <p className="mt-1.5 text-xs text-muted">
            The unsubscribe footer is added automatically. A test send is not available until real
            email is configured.
          </p>
        </div>
        <div className="max-w-xs">
          <Label htmlFor="campaign-schedule">Schedule (optional)</Label>
          <Input id="campaign-schedule" name="scheduledAt" type="datetime-local" />
          <p className="mt-1.5 text-xs text-muted">
            Leave blank for a draft. Scheduled campaigns send when “Process scheduled” runs.
          </p>
        </div>
        <Button type="submit">Create campaign</Button>
      </form>
    </div>
  );
}
