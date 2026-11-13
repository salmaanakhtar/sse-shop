import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryForm } from "@/components/admin/category-form";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import {
  buildCategoryTree,
  descendantIds,
  findCategoryById,
  flattenCategoryTree,
} from "@/lib/categories";
import {
  deleteCategoryAction,
  updateCategoryAction,
} from "@/server/actions/admin-categories";
import { requireAdminPage } from "@/server/auth/guard";
import { getCategory, listAllCategories } from "@/server/services/categories";

export const metadata = { title: "Edit category" };

export default async function EditCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const [category, rows] = await Promise.all([getCategory(id), listAllCategories()]);

  if (!category) notFound();

  const tree = buildCategoryTree(rows);
  const node = findCategoryById(tree, id);
  const categories = flattenCategoryTree(tree);
  const blocked = node ? descendantIds(node) : [id];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{category.name}</h1>
          <p className="mt-1 text-xs text-muted">/category/{category.slug}</p>
        </div>
        <Link href="/admin/categories" className="text-sm text-muted hover:text-ink">
          All categories
        </Link>
      </div>

      <CategoryForm
        action={updateCategoryAction}
        values={category}
        categories={categories}
        excludeIds={blocked}
        submitLabel="Save category"
        error={error}
      />

      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">Delete category</h2>
        <p className="mt-2 text-sm text-muted">
          A category with children or assigned products cannot be deleted. The audit log keeps
          the delete event.
        </p>
        <form action={deleteCategoryAction} className="mt-4">
          <input type="hidden" name="id" value={category.id} />
          <ConfirmSubmitButton
            type="submit"
            message={`Delete ${category.name}?`}
            className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Delete category
          </ConfirmSubmitButton>
        </form>
      </section>
    </div>
  );
}
