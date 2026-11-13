import Link from "next/link";
import { CollectionForm } from "@/components/admin/collection-form";
import { createCollectionAction } from "@/server/actions/admin-collections";
import { requireAdminPage } from "@/server/auth/guard";

export const metadata = { title: "New collection" };

export default async function NewCollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">New collection</h1>
          <p className="mt-1 text-sm text-muted">
            Create it first, then choose the products and their order.
          </p>
        </div>
        <Link href="/admin/collections" className="text-sm text-muted hover:text-ink">
          Cancel
        </Link>
      </div>

      <CollectionForm
        action={createCollectionAction}
        submitLabel="Create collection"
        error={error}
      />
    </div>
  );
}
