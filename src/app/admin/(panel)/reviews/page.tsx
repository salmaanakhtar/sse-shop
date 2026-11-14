import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import {
  deleteReviewAction,
  moderateReviewAction,
} from "@/server/actions/admin-reviews";
import { requireAdminPage } from "@/server/auth/guard";
import { listAdminReviews } from "@/server/services/reviews";

export const metadata = { title: "Reviews" };

const STATUSES = ["pending", "approved", "rejected"] as const;

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdminPage();
  const { status } = await searchParams;
  const selected = STATUSES.includes(status as (typeof STATUSES)[number])
    ? (status as (typeof STATUSES)[number])
    : undefined;
  const reviews = await listAdminReviews(selected);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Reviews</h1>
        <p className="mt-1 text-sm text-muted">
          Verified-purchase reviews. Approve before they appear on the storefront.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2">
        <Link
          href="/admin/reviews"
          className={buttonClass(selected ? "secondary" : "primary", "sm")}
        >
          All
        </Link>
        {STATUSES.map((item) => (
          <Link
            key={item}
            href={`/admin/reviews?status=${item}`}
            className={buttonClass(selected === item ? "primary" : "secondary", "sm")}
          >
            {item}
          </Link>
        ))}
      </nav>

      <div className="space-y-3">
        {reviews.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
            No reviews in this view.
          </p>
        ) : (
          reviews.map((review) => (
            <article key={review.id} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    <Link
                      href={`/products/${review.productSlug}`}
                      target="_blank"
                      className="hover:text-brand"
                    >
                      {review.productTitle}
                    </Link>
                  </p>
                  <p className="text-xs text-muted">
                    {review.customerName} · {review.customerEmail} ·{" "}
                    {review.createdAt.toLocaleDateString("en-AE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                    review.status === "approved"
                      ? "bg-emerald-50 text-emerald-700"
                      : review.status === "rejected"
                        ? "bg-red-50 text-red-700"
                        : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {review.status}
                </span>
              </div>

              <div className="mt-3">
                <p className="text-amber-500">{"★".repeat(review.rating)}</p>
                {review.title ? (
                  <h2 className="mt-1 text-sm font-semibold">{review.title}</h2>
                ) : null}
                <p className="mt-1 whitespace-pre-line text-sm text-muted">{review.body}</p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                {review.status !== "approved" ? (
                  <form action={moderateReviewAction}>
                    <input type="hidden" name="id" value={review.id} />
                    <input type="hidden" name="status" value="approved" />
                    <button
                      type="submit"
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      Approve
                    </button>
                  </form>
                ) : null}
                {review.status !== "rejected" ? (
                  <form action={moderateReviewAction}>
                    <input type="hidden" name="id" value={review.id} />
                    <input type="hidden" name="status" value="rejected" />
                    <button
                      type="submit"
                      className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-muted hover:text-ink"
                    >
                      Reject
                    </button>
                  </form>
                ) : null}
                <form action={deleteReviewAction} className="ml-auto">
                  <input type="hidden" name="id" value={review.id} />
                  <ConfirmSubmitButton
                    type="submit"
                    message="Delete this review?"
                    className="text-xs text-muted hover:text-red-600"
                  >
                    Delete
                  </ConfirmSubmitButton>
                </form>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
