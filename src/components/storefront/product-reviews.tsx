import { ReviewForm } from "@/components/storefront/review-form";
import { formatDateFor, translate } from "@/lib/i18n";
import { getLocale, getNumeralPreference } from "@/server/services/preferences";
import type { ReviewSummary, ReviewView } from "@/server/services/reviews";

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} / 5`} className="text-sm text-amber-500">
      {"★".repeat(rating)}
      <span className="text-line">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export async function ProductReviews({
  productId,
  reviews,
  summary,
  canReview,
  myReviewStatus,
}: {
  productId: string;
  reviews: ReviewView[];
  summary: ReviewSummary;
  canReview: boolean;
  myReviewStatus?: "pending" | "approved" | "rejected";
}) {
  const [locale, numerals] = await Promise.all([getLocale(), getNumeralPreference()]);
  const average = new Intl.NumberFormat(locale === "ar" ? "ar-AE" : "en-AE", {
    numberingSystem: numerals === "arabic" ? "arab" : "latn",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(summary.average);

  return (
    <section className="mx-auto max-w-5xl px-6 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-8">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {translate(locale, "reviews.title")}
          </h2>
          {summary.count > 0 ? (
            <p className="mt-1 text-sm text-muted">
              <Stars rating={Math.round(summary.average)} />{" "}
              {translate(locale, "reviews.average", {
                rating: average,
                count: summary.count,
              })}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <p className="text-sm text-muted">{translate(locale, "reviews.none")}</p>
          ) : (
            reviews.map((review) => (
              <article key={review.id} className="rounded-xl border border-line bg-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Stars rating={review.rating} />
                    {review.title ? (
                      <h3 className="mt-1 text-sm font-semibold">{review.title}</h3>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted">
                    {review.authorName} ·{" "}
                    {formatDateFor(review.createdAt, locale, numerals, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">
                  {review.body}
                </p>
              </article>
            ))
          )}
        </div>

        <ReviewForm
          productId={productId}
          canReview={canReview}
          existingStatus={myReviewStatus}
        />
      </div>
    </section>
  );
}
