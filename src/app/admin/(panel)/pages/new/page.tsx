import Link from "next/link";
import { PageForm } from "@/components/admin/page-form";
import { createPageAction } from "@/server/actions/admin-pages";
import { requireAdminPage } from "@/server/auth/guard";

export const metadata = { title: "New page" };

export default async function NewPagePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">New page</h1>
          <p className="mt-1 text-sm text-muted">
            Published pages appear in the storefront footer.
          </p>
        </div>
        <Link href="/admin/pages" className="text-sm text-muted hover:text-ink">
          Cancel
        </Link>
      </div>

      <PageForm action={createPageAction} submitLabel="Create page" error={error} />
    </div>
  );
}
