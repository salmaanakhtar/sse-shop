import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";

export type CollectionFormValues = {
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  active?: boolean;
};

export function CollectionForm({
  action,
  values,
  submitLabel,
  error,
}: {
  action: (formData: FormData) => void | Promise<void>;
  values?: CollectionFormValues;
  submitLabel: string;
  error?: string;
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
          <Label htmlFor="collection-name">Name</Label>
          <Input
            id="collection-name"
            name="name"
            required
            maxLength={80}
            defaultValue={values?.name ?? ""}
            placeholder="Best Selling"
          />
        </div>
        <div>
          <Label htmlFor="collection-slug">URL slug</Label>
          <Input
            id="collection-slug"
            name="slug"
            maxLength={80}
            defaultValue={values?.slug ?? ""}
            placeholder="best-selling"
          />
          <p className="mt-1.5 text-xs text-muted">Leave empty to derive it from the name.</p>
        </div>
      </div>

      <div>
        <Label htmlFor="collection-description">Description</Label>
        <Textarea
          id="collection-description"
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={values?.description ?? ""}
          placeholder="A short line shown above the collection on the storefront."
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={values?.active ?? true}
          className="size-4"
        />
        Active — shown on the home page
      </label>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
