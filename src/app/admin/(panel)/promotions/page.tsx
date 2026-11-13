import Image from "next/image";
import Link from "next/link";
import {
  deletePromotionAction,
  movePromotionAction,
} from "@/server/actions/admin-promotions";
import { buttonClass } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { formatDubaiDateTime } from "@/lib/dates";
import { requireAdminPage } from "@/server/auth/guard";
import { listAdminPromotions } from "@/server/services/promotions";

export const metadata = { title: "Promotions" };

const STATUS_STYLE: Record<string, string> = {
  live: "bg-emerald-50 text-emerald-700",
  scheduled: "bg-amber-50 text-amber-700",
  expired: "bg-zinc-100 text-zinc-600",
  inactive: "bg-zinc-100 text-zinc-600",
};

export default async function AdminPromotionsPage() {
  await requireAdminPage();
  const promotions = await listAdminPromotions();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Promotions</h1>
          <p className="mt-1 text-sm text-muted">
            Slides shown at the top of the storefront home page, in this order.
          </p>
        </div>
        <Link href="/admin/promotions/new" className={buttonClass("primary", "sm")}>
          New promotion
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {promotions.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-muted">No promotions yet.</p>
            <Link href="/admin/promotions/new" className={buttonClass("primary", "sm", "mt-4")}>
              Add the first promotion
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">Promotion</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">Page</th>
                <th className="hidden px-5 py-3 font-semibold lg:table-cell">Window</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Order</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {promotions.map((promotion, index) => (
                <tr key={promotion.id} className="hover:bg-page/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Image
                        src={`/media/${promotion.imageKey}`}
                        alt={promotion.imageAlt || promotion.headline || "Promotion"}
                        width={80}
                        height={48}
                        className="h-12 w-20 rounded-md border border-line object-cover"
                      />
                      <div className="min-w-0">
                        <Link
                          href={`/admin/promotions/${promotion.id}`}
                          className="font-medium hover:text-brand"
                        >
                          {promotion.headline || "Untitled promotion"}
                        </Link>
                        {promotion.subheadline ? (
                          <p className="truncate text-xs text-muted">{promotion.subheadline}</p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-5 py-3 text-xs text-muted sm:table-cell">
                    <Link
                      href={promotion.href}
                      target="_blank"
                      className="block text-ink underline-offset-4 hover:underline"
                    >
                      /promotions/{promotion.slug}
                    </Link>
                    <span className="block capitalize">{promotion.status}</span>
                  </td>
                  <td className="hidden px-5 py-3 text-xs text-muted lg:table-cell">
                    {promotion.startsAt || promotion.endsAt
                      ? `${formatDubaiDateTime(promotion.startsAt) || "Open"} → ${
                          formatDubaiDateTime(promotion.endsAt) || "Open"
                        }`
                      : "Always"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        STATUS_STYLE[promotion.status] ?? ""
                      }`}
                    >
                      {promotion.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <form action={movePromotionAction}>
                        <input type="hidden" name="id" value={promotion.id} />
                        <input type="hidden" name="direction" value="up" />
                        <button
                          type="submit"
                          disabled={index === 0}
                          aria-label={`Move ${promotion.headline || "slide"} up`}
                          className="flex size-7 items-center justify-center rounded border border-line text-xs text-muted hover:text-ink disabled:opacity-30"
                        >
                          ↑
                        </button>
                      </form>
                      <form action={movePromotionAction}>
                        <input type="hidden" name="id" value={promotion.id} />
                        <input type="hidden" name="direction" value="down" />
                        <button
                          type="submit"
                          disabled={index === promotions.length - 1}
                          aria-label={`Move ${promotion.headline || "slide"} down`}
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
                        href={`/admin/promotions/${promotion.id}`}
                        className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
                      >
                        Edit
                      </Link>
                      <form action={deletePromotionAction}>
                        <input type="hidden" name="id" value={promotion.id} />
                        <ConfirmSubmitButton
                          type="submit"
                          message="Delete this slide?"
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
      </div>
    </div>
  );
}
