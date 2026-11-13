import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { buildCategoryTree, flattenCategoryTree } from "@/lib/categories";
import { requireAdminPage } from "@/server/auth/guard";
import {
  deleteCategoryAction,
  moveCategoryAction,
} from "@/server/actions/admin-categories";
import { listAdminCategories } from "@/server/services/categories";

export const metadata = { title: "Categories" };

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const [{ error }, rows] = await Promise.all([searchParams, listAdminCategories()]);

  const flat = flattenCategoryTree(buildCategoryTree(rows));
  const counts = new Map(rows.map((row) => [row.id, row.productCount]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Categories</h1>
          <p className="mt-1 text-sm text-muted">
            The category tree drives the storefront navigation. Order is sibling order.
          </p>
        </div>
        <Link href="/admin/categories/new" className={buttonClass("primary", "sm")}>
          New category
        </Link>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {flat.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-muted">No categories yet.</p>
            <Link
              href="/admin/categories/new"
              className={buttonClass("primary", "sm", "mt-4")}
            >
              Add the first category
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">Category</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">Status</th>
                <th className="hidden px-5 py-3 font-semibold md:table-cell">Products</th>
                <th className="px-5 py-3 font-semibold">Order</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {flat.map((category) => {
                const siblings = flat.filter(
                  (item) => item.parentId === category.parentId,
                );
                const index = siblings.findIndex((item) => item.id === category.id);

                return (
                  <tr key={category.id} className="hover:bg-page/60">
                    <td className="px-5 py-3">
                      <div style={{ paddingLeft: `${category.depth * 18}px` }}>
                        <Link
                          href={`/admin/categories/${category.id}`}
                          className="font-medium hover:text-brand"
                        >
                          {category.depth > 0 ? "↳ " : ""}
                          {category.name}
                        </Link>
                        <p className="text-xs text-muted">/category/{category.slug}</p>
                      </div>
                    </td>
                    <td className="hidden px-5 py-3 sm:table-cell">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          category.active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {category.active ? "active" : "inactive"}
                      </span>
                    </td>
                    <td className="hidden px-5 py-3 text-muted md:table-cell">
                      {counts.get(category.id) ?? 0}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <form action={moveCategoryAction}>
                          <input type="hidden" name="id" value={category.id} />
                          <input type="hidden" name="direction" value="up" />
                          <button
                            type="submit"
                            disabled={index === 0}
                            aria-label={`Move ${category.name} up`}
                            className="flex size-7 items-center justify-center rounded border border-line text-xs text-muted hover:text-ink disabled:opacity-30"
                          >
                            ↑
                          </button>
                        </form>
                        <form action={moveCategoryAction}>
                          <input type="hidden" name="id" value={category.id} />
                          <input type="hidden" name="direction" value="down" />
                          <button
                            type="submit"
                            disabled={index === siblings.length - 1}
                            aria-label={`Move ${category.name} down`}
                            className="flex size-7 items-center justify-center rounded border border-line text-xs text-muted hover:text-ink disabled:opacity-30"
                          >
                            ↓
                          </button>
                        </form>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/categories/${category.id}`}
                          className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
                        >
                          Edit
                        </Link>
                        <form action={deleteCategoryAction}>
                          <input type="hidden" name="id" value={category.id} />
                          <ConfirmSubmitButton
                            type="submit"
                            message={`Delete ${category.name}?`}
                            className="text-xs text-muted underline-offset-4 hover:text-red-600 hover:underline"
                          >
                            Delete
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
