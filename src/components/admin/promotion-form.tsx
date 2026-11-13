import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { formatDubaiDateTimeInput } from "@/lib/dates";

export type PromotionFormValues = {
  id?: string;
  slug?: string;
  headline?: string;
  subheadline?: string;
  ctaLabel?: string;
  imageAlt?: string;
  active?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
};

export function PromotionForm({
  action,
  values,
  submitLabel,
  error,
  showImage = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  values?: PromotionFormValues;
  submitLabel: string;
  error?: string;
  showImage?: boolean;
}) {
  return (
    <form action={action} className="space-y-5 rounded-xl border border-line bg-surface p-6">
      {values?.id ? <input type="hidden" name="id" value={values.id} /> : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="promotion-headline">Headline</Label>
          <Input
            id="promotion-headline"
            name="headline"
            maxLength={120}
            defaultValue={values?.headline ?? ""}
            placeholder="Weekend sale"
          />
          <p className="mt-1.5 text-xs text-muted">Optional; the image and CTA still work.</p>
        </div>
        <div>
          <Label htmlFor="promotion-slug">Page URL slug</Label>
          <Input
            id="promotion-slug"
            name="slug"
            maxLength={80}
            defaultValue={values?.slug ?? ""}
            placeholder="hardware-sale"
          />
          <p className="mt-1.5 text-xs text-muted">
            The slide links to /promotions/&lt;slug&gt;. Leave empty to derive it from the headline.
            Changing it later breaks old links.
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="promotion-subheadline">Subheadline</Label>
        <Input
          id="promotion-subheadline"
          name="subheadline"
          maxLength={240}
          defaultValue={values?.subheadline ?? ""}
          placeholder="Up to 34% off selected pieces"
        />
      </div>

      <div>
        <Label htmlFor="promotion-cta">Button label</Label>
        <Input
          id="promotion-cta"
          name="ctaLabel"
          maxLength={40}
          defaultValue={values?.ctaLabel ?? "Shop now"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="promotion-starts">Starts (Dubai)</Label>
          <Input
            id="promotion-starts"
            name="startsAt"
            type="datetime-local"
            defaultValue={formatDubaiDateTimeInput(values?.startsAt)}
          />
        </div>
        <div>
          <Label htmlFor="promotion-ends">Ends (Dubai)</Label>
          <Input
            id="promotion-ends"
            name="endsAt"
            type="datetime-local"
            defaultValue={formatDubaiDateTimeInput(values?.endsAt)}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={values?.active ?? true}
          className="size-4"
        />
        Active
      </label>

      {showImage ? (
        <div className="border-t border-line pt-5">
          <Label htmlFor="promotion-image">Slide image</Label>
          <input
            id="promotion-image"
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            required
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-page file:px-3 file:py-1.5 file:text-sm"
          />
          <p className="mt-1.5 text-xs text-muted">
            Re-encoded to WebP. Use a wide image, at least 1600px wide.
          </p>
          <div className="mt-4">
            <Label htmlFor="promotion-image-alt">Image alt text</Label>
            <Input
              id="promotion-image-alt"
              name="imageAlt"
              maxLength={160}
              defaultValue={values?.imageAlt ?? ""}
              placeholder="Model wearing the weekend collection"
            />
          </div>
        </div>
      ) : null}

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
