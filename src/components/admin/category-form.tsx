import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import type { FlatCategory } from "@/lib/categories";

export type CategoryFormValues = {
  id?: string;
  name?: string;
  slug?: string;
  description?: string;
  parentId?: string | null;
  active?: boolean;
};

export function CategoryForm({
  action,
  values,
  categories,
  excludeIds = [],
  submitLabel,
  error,
}: {
  action: (formData: FormData) => void | Promise<void>;
  values?: CategoryFormValues;
  categories: FlatCategory[];
  excludeIds?: string[];
  submitLabel: string;
  error?: string;
}) {
  const blocked = new Set(excludeIds);

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
          <Label htmlFor="category-name">Name</Label>
          <Input
            id="category-name"
            name="name"
            required
            maxLength={80}
            defaultValue={values?.name ?? ""}
            placeholder="Tops"
          />
        </div>
        <div>
          <Label htmlFor="category-slug">URL slug</Label>
          <Input
            id="category-slug"
            name="slug"
            maxLength={80}
            defaultValue={values?.slug ?? ""}
            placeholder="tops"
          />
          <p className="mt-1.5 text-xs text-muted">Leave empty to derive it from the name.</p>
        </div>
      </div>

      <div>
        <Label htmlFor="category-parent">Parent category</Label>
        <select
          id="category-parent"
          name="parentId"
          defaultValue={values?.parentId ?? ""}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        >
          <option value="">Top level</option>
          {categories
            .filter((category) => !blocked.has(category.id))
            .map((category) => (
              <option key={category.id} value={category.id}>
                {"— ".repeat(category.depth)}
                {category.name}
                {category.active ? "" : " (inactive)"}
              </option>
            ))}
        </select>
      </div>

      <div>
        <Label htmlFor="category-description">Description</Label>
        <Textarea
          id="category-description"
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={values?.description ?? ""}
          placeholder="What belongs in this category."
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={values?.active ?? true}
          className="size-4"
        />
        Active — shown in the storefront navbar
      </label>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
