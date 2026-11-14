"use client";

import { useActionState } from "react";
import { submitReviewAction, type ReviewState } from "@/app/(storefront)/review-actions";
import { useStorePreferences } from "@/components/storefront/store-preferences";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";

const initialState: ReviewState = null;

export function ReviewForm({
  productId,
  canReview,
  existingStatus,
}: {
  productId: string;
  canReview: boolean;
  existingStatus?: "pending" | "approved" | "rejected";
}) {
  const { t } = useStorePreferences();
  const [state, action, pending] = useActionState(submitReviewAction, initialState);

  if (!canReview) {
    return <p className="text-sm text-muted">{t("reviews.verified")}</p>;
  }

  if (existingStatus === "approved") {
    return <p className="text-sm text-muted">{t("reviews.thanks")}</p>;
  }

  return (
    <form action={action} className="space-y-4 rounded-xl border border-line bg-surface p-5">
      <input type="hidden" name="productId" value={productId} />
      <h3 className="text-sm font-semibold">{t("reviews.write")}</h3>

      {existingStatus === "pending" ? (
        <p role="status" className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("reviews.thanks")}
        </p>
      ) : null}

      <div className="max-w-40">
        <Label htmlFor="review-rating">{t("reviews.rating")}</Label>
        <select
          id="review-rating"
          name="rating"
          required
          defaultValue="5"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        >
          {[5, 4, 3, 2, 1].map((rating) => (
            <option key={rating} value={rating}>
              {t("reviews.star", { count: rating })}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="review-title">{t("reviews.titleLabel")}</Label>
        <Input id="review-title" name="title" maxLength={120} />
      </div>

      <div>
        <Label htmlFor="review-body">{t("reviews.body")}</Label>
        <Textarea id="review-body" name="body" rows={5} required minLength={10} maxLength={2000} />
      </div>

      {state?.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p role="status" className="text-sm text-emerald-700">
          {state.success}
        </p>
      ) : null}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? t("reviews.submitting") : t("reviews.submit")}
      </Button>
    </form>
  );
}
