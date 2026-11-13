import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PromotionForm } from "@/components/admin/promotion-form";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input, Label } from "@/components/ui/field";
import {
  deletePromotionAction,
  replacePromotionImageAction,
  updatePromotionAction,
} from "@/server/actions/admin-promotions";
import { formatDubaiDateTime } from "@/lib/dates";
import { requireAdminPage } from "@/server/auth/guard";
import { getPromotion } from "@/server/services/promotions";

export const metadata = { title: "Edit promotion" };

export default async function EditPromotionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const promotion = await getPromotion(id);
  if (!promotion) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {promotion.headline || "Untitled slide"}
          </h1>
          <p className="mt-1 text-xs text-muted capitalize">{promotion.status}</p>
          {promotion.startsAt || promotion.endsAt ? (
            <p className="mt-1 text-xs text-muted">
              {formatDubaiDateTime(promotion.startsAt) || "Open"} →{" "}
              {formatDubaiDateTime(promotion.endsAt) || "Open"}
            </p>
          ) : null}
        </div>
        <Link href="/admin/promotions" className="text-sm text-muted hover:text-ink">
          All promotions
        </Link>
      </div>

      <PromotionForm
        action={updatePromotionAction}
        values={promotion}
        submitLabel="Save slide"
        error={error}
      />

      <section className="space-y-4 rounded-xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">Image</h2>
        <Image
          src={`/media/${promotion.imageKey}`}
          alt={promotion.imageAlt || promotion.headline || "Promotion"}
          width={640}
          height={320}
          className="aspect-[2/1] w-full rounded-lg border border-line object-cover"
        />
        <form action={replacePromotionImageAction} className="space-y-3">
          <input type="hidden" name="id" value={promotion.id} />
          <div>
            <Label htmlFor="replacement-image">Replace image</Label>
            <input
              id="replacement-image"
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              required
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-page file:px-3 file:py-1.5 file:text-sm"
            />
          </div>
          <div>
            <Label htmlFor="replacement-alt">Alt text</Label>
            <Input
              id="replacement-alt"
              name="imageAlt"
              maxLength={160}
              defaultValue={promotion.imageAlt}
            />
          </div>
          <Button type="submit" size="sm" variant="secondary">
            Replace image
          </Button>
        </form>
      </section>

      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">Delete slide</h2>
        <p className="mt-2 text-sm text-muted">
          This removes the slide and its image. The audit log keeps the delete event.
        </p>
        <form action={deletePromotionAction} className="mt-4">
          <input type="hidden" name="id" value={promotion.id} />
          <ConfirmSubmitButton
            type="submit"
            message="Delete this slide?"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Delete slide
          </ConfirmSubmitButton>
        </form>
      </section>
    </div>
  );
}
