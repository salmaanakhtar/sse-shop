import Link from "next/link";
import { CategoryForm } from "@/components/admin/category-form";
import { buildCategoryTree, flattenCategoryTree } from "@/lib/categories";
import { createCategoryAction } from "@/server/actions/admin-categories";
import { requireAdminPage } from "@/server/auth/guard";
import { listAllCategories } from "@/server/services/categories";

export const metadata = { title: "New category" };

export default async function NewCategoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const [{ error }, rows] = await Promise.all([searchParams, listAllCategories()]);
  const categories = flattenCategoryTree(buildCategoryTree(rows));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">New category</h1>
          <p className="mt-1 text-sm text-muted">
            Top-level categories appear in the storefront navbar; children appear in their
            dropdown.
          </p>
        </div>
        <Link href="/admin/categories" className="text-sm text-muted hover:text-ink">
          Cancel
        </Link>
      </div>

      <CategoryForm
        action={createCategoryAction}
        categories={categories}
        submitLabel="Create category"
        error={error}
      />
    </div>
  );
}
