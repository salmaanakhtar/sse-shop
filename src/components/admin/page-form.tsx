import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";

export type PageFormValues = {
  id?: string;
  slug?: string;
  title?: string;
  body?: string;
  published?: boolean;
  seoTitle?: string;
  seoDescription?: string;
};

export function PageForm({
  action,
  values,
  submitLabel,
  error,
}: {
  action: (formData: FormData) => void | Promise<void>;
  values?: PageFormValues;
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
          <Label htmlFor="page-title">Title</Label>
          <Input id="page-title" name="title" required defaultValue={values?.title ?? ""} />
        </div>
        <div>
          <Label htmlFor="page-slug">URL slug</Label>
          <Input
            id="page-slug"
            name="slug"
            defaultValue={values?.slug ?? ""}
            placeholder="privacy"
          />
          <p className="mt-1.5 text-xs text-muted">The page will be at /pages/slug.</p>
        </div>
      </div>

      <div>
        <Label htmlFor="page-body">Content (HTML)</Label>
        <Textarea
          id="page-body"
          name="body"
          rows={18}
          required
          defaultValue={values?.body ?? ""}
          className="font-mono text-xs"
          placeholder="<h2>Privacy</h2><p>...</p>"
        />
        <p className="mt-1.5 text-xs text-muted">
          Trusted admin HTML. Use headings, paragraphs, and lists. Do not paste scripts.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="page-seo-title">SEO title</Label>
          <Input
            id="page-seo-title"
            name="seoTitle"
            maxLength={120}
            defaultValue={values?.seoTitle ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="page-seo-description">SEO description</Label>
          <Input
            id="page-seo-description"
            name="seoDescription"
            maxLength={240}
            defaultValue={values?.seoDescription ?? ""}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="published"
          defaultChecked={values?.published ?? false}
          className="size-4"
        />
        Published
      </label>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
