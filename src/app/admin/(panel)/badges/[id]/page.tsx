import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeForm } from "@/components/admin/badge-form";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { badgeToneClass } from "@/lib/badges";
import { deleteBadgeAction, updateBadgeAction } from "@/server/actions/admin-badges";
import { requireAdminPage } from "@/server/auth/guard";
import { getBadge } from "@/server/services/badges";

export const metadata = { title: "Edit badge" };

export default async function EditBadgePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const badge = await getBadge(id);

  if (!badge) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{badge.label}</h1>
          <span
            className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ${badgeToneClass(
              badge.tone,
            )}`}
          >
            {badge.label}
          </span>
        </div>
        <Link href="/admin/badges" className="text-sm text-muted hover:text-ink">
          All badges
        </Link>
      </div>

      <BadgeForm
        action={updateBadgeAction}
        values={badge}
        submitLabel="Save badge"
        error={error}
      />

      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">Delete badge</h2>
        <p className="mt-2 text-sm text-muted">
          This removes the badge from every product. The audit log keeps the delete event.
        </p>
        <form action={deleteBadgeAction} className="mt-4">
          <input type="hidden" name="id" value={badge.id} />
          <ConfirmSubmitButton
            type="submit"
            message={`Delete ${badge.label}?`}
            className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Delete badge
          </ConfirmSubmitButton>
        </form>
      </section>
    </div>
  );
}
