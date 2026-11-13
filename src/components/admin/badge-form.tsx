import { BADGE_TONES, badgeToneClass } from "@/lib/badges";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

export type BadgeFormValues = {
  id?: string;
  label?: string;
  tone?: string;
  active?: boolean;
};

export function BadgeForm({
  action,
  values,
  submitLabel,
  error,
}: {
  action: (formData: FormData) => void | Promise<void>;
  values?: BadgeFormValues;
  submitLabel: string;
  error?: string;
}) {
  const tone = values?.tone ?? "brand";

  return (
    <form action={action} className="space-y-5 rounded-xl border border-line bg-surface p-6">
      {values?.id ? <input type="hidden" name="id" value={values.id} /> : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <div>
          <Label htmlFor="badge-label">Label</Label>
          <Input
            id="badge-label"
            name="label"
            required
            maxLength={40}
            defaultValue={values?.label ?? ""}
            placeholder="Best Seller"
          />
        </div>
        <div>
          <Label htmlFor="badge-tone">Tone</Label>
          <select
            id="badge-tone"
            name="tone"
            defaultValue={tone}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          >
            {BADGE_TONES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg bg-page px-4 py-3">
        <span className="text-xs text-muted">Preview</span>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ${badgeToneClass(
            tone,
          )}`}
        >
          {values?.label || "Badge label"}
        </span>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={values?.active ?? true}
          className="size-4"
        />
        Active — shown on product cards
      </label>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
