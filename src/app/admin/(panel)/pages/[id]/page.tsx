import Link from "next/link";
import { notFound } from "next/navigation";
import { PageForm } from "@/components/admin/page-form";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { deletePageAction, updatePageAction } from "@/server/actions/admin-pages";
import { requireAdminPage } from "@/server/auth/guard";
import { getPage } from "@/server/services/pages";

export const metadata = { title: "Edit page" };

export default async function EditPagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const page = await getPage(id);
  if (!page) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{page.title}</h1>
          <p className="mt-1 text-xs text-muted">/pages/{page.slug}</p>
        </div>
        <div className="flex items-center gap-3">
          {page.published ? (
            <Link
              href={`/pages/${page.slug}`}
              target="_blank"
              className="text-sm text-muted hover:text-ink"
            >
              View page
            </Link>
          ) : null}
          <Link href="/admin/pages" className="text-sm text-muted hover:text-ink">
            All pages
          </Link>
        </div>
      </div>

      <PageForm
        action={updatePageAction}
        values={page}
        submitLabel="Save page"
        error={error}
      />

      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">Delete page</h2>
        <p className="mt-2 text-sm text-muted">
          This removes the page and its footer link. The audit log keeps the delete event.
        </p>
        <form action={deletePageAction} className="mt-4">
          <input type="hidden" name="id" value={page.id} />
          <ConfirmSubmitButton
            type="submit"
            message={`Delete ${page.title}?`}
            className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Delete page
          </ConfirmSubmitButton>
        </form>
      </section>
    </div>
  );
}
