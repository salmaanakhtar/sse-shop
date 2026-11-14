import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { deletePageAction } from "@/server/actions/admin-pages";
import { requireAdminPage } from "@/server/auth/guard";
import { listPages } from "@/server/services/pages";

export const metadata = { title: "Pages" };

export default async function AdminPagesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const [{ error }, pages] = await Promise.all([searchParams, listPages(false)]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Pages</h1>
          <p className="mt-1 text-sm text-muted">
            Legal, support, and trust pages. Published pages are linked from the storefront footer.
          </p>
        </div>
        <Link href="/admin/pages/new" className={buttonClass("primary", "sm")}>
          New page
        </Link>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {pages.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted">
            No pages yet. Create Privacy, Terms, Shipping, Returns, Contact, FAQ, and Cookies.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">Page</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">URL</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {pages.map((page) => (
                <tr key={page.id} className="hover:bg-page/60">
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/pages/${page.id}`}
                      className="font-medium hover:text-brand"
                    >
                      {page.title}
                    </Link>
                  </td>
                  <td className="hidden px-5 py-3 text-xs text-muted sm:table-cell">
                    /pages/{page.slug}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        page.published
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {page.published ? "published" : "draft"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {page.published ? (
                        <Link
                          href={`/pages/${page.slug}`}
                          target="_blank"
                          className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
                        >
                          View
                        </Link>
                      ) : null}
                      <Link
                        href={`/admin/pages/${page.id}`}
                        className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
                      >
                        Edit
                      </Link>
                      <form action={deletePageAction}>
                        <input type="hidden" name="id" value={page.id} />
                        <ConfirmSubmitButton
                          type="submit"
                          message={`Delete ${page.title}?`}
                          className="text-xs text-muted underline-offset-4 hover:text-red-600 hover:underline"
                        >
                          Delete
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
