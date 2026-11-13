import Link from "next/link";
import { BadgeForm } from "@/components/admin/badge-form";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { badgeToneClass } from "@/lib/badges";
import {
  createBadgeAction,
  deleteBadgeAction,
  moveBadgeAction,
} from "@/server/actions/admin-badges";
import { requireAdminPage } from "@/server/auth/guard";
import { listBadges } from "@/server/services/badges";

export const metadata = { title: "Badges" };

export default async function AdminBadgesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const [{ error }, badges] = await Promise.all([searchParams, listBadges()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Badges</h1>
        <p className="mt-1 text-sm text-muted">
          Reusable labels such as Best Seller or Powered by AMD. Assign them on a product page.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <section>
          <h2 className="mb-3 text-sm font-semibold">New badge</h2>
          <BadgeForm action={createBadgeAction} submitLabel="Create badge" />
        </section>

        <section className="overflow-hidden rounded-xl border border-line bg-surface">
          {badges.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted">
              No badges yet. Create one on the left.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-5 py-3 font-semibold">Badge</th>
                  <th className="hidden px-5 py-3 font-semibold sm:table-cell">Tone</th>
                  <th className="hidden px-5 py-3 font-semibold md:table-cell">Status</th>
                  <th className="px-5 py-3 font-semibold">Order</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {badges.map((badge, index) => (
                  <tr key={badge.id} className="hover:bg-page/60">
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ${badgeToneClass(
                          badge.tone,
                        )}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="hidden px-5 py-3 text-xs text-muted capitalize sm:table-cell">
                      {badge.tone}
                    </td>
                    <td className="hidden px-5 py-3 md:table-cell">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          badge.active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {badge.active ? "active" : "inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <form action={moveBadgeAction}>
                          <input type="hidden" name="id" value={badge.id} />
                          <input type="hidden" name="direction" value="up" />
                          <button
                            type="submit"
                            disabled={index === 0}
                            aria-label={`Move ${badge.label} up`}
                            className="flex size-7 items-center justify-center rounded border border-line text-xs text-muted hover:text-ink disabled:opacity-30"
                          >
                            ↑
                          </button>
                        </form>
                        <form action={moveBadgeAction}>
                          <input type="hidden" name="id" value={badge.id} />
                          <input type="hidden" name="direction" value="down" />
                          <button
                            type="submit"
                            disabled={index === badges.length - 1}
                            aria-label={`Move ${badge.label} down`}
                            className="flex size-7 items-center justify-center rounded border border-line text-xs text-muted hover:text-ink disabled:opacity-30"
                          >
                            ↓
                          </button>
                        </form>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/badges/${badge.id}`}
                          className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
                        >
                          Edit
                        </Link>
                        <form action={deleteBadgeAction}>
                          <input type="hidden" name="id" value={badge.id} />
                          <ConfirmSubmitButton
                            type="submit"
                            message={`Delete ${badge.label}?`}
                            className="text-xs text-muted underline-offset-4 hover:text-red-600 hover:underline"
                          >
                            Delete
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
