import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import {
  deleteCollectionAction,
  moveCollectionAction,
} from "@/server/actions/admin-collections";
import { requireAdminPage } from "@/server/auth/guard";
import { listAdminCollections } from "@/server/services/collections";

export const metadata = { title: "Collections" };

export default async function AdminCollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const [{ error }, collections] = await Promise.all([
    searchParams,
    listAdminCollections(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Collections</h1>
          <p className="mt-1 text-sm text-muted">
            Curated product rows on the home page, in this order.
          </p>
        </div>
        <Link href="/admin/collections/new" className={buttonClass("primary", "sm")}>
          New collection
        </Link>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {collections.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-muted">No collections yet.</p>
            <Link
              href="/admin/collections/new"
              className={buttonClass("primary", "sm", "mt-4")}
            >
              Add the first collection
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">Collection</th>
                <th className="hidden px-5 py-3 font-semibold sm:table-cell">Status</th>
                <th className="hidden px-5 py-3 font-semibold md:table-cell">Products</th>
                <th className="px-5 py-3 font-semibold">Order</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {collections.map((collection, index) => (
                <tr key={collection.id} className="hover:bg-page/60">
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/collections/${collection.id}`}
                      className="font-medium hover:text-brand"
                    >
                      {collection.name}
                    </Link>
                    <p className="text-xs text-muted">/collections/{collection.slug}</p>
                  </td>
                  <td className="hidden px-5 py-3 sm:table-cell">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        collection.active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {collection.active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="hidden px-5 py-3 text-muted md:table-cell">
                    {collection.productCount}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <form action={moveCollectionAction}>
                        <input type="hidden" name="id" value={collection.id} />
                        <input type="hidden" name="direction" value="up" />
                        <button
                          type="submit"
                          disabled={index === 0}
                          aria-label={`Move ${collection.name} up`}
                          className="flex size-7 items-center justify-center rounded border border-line text-xs text-muted hover:text-ink disabled:opacity-30"
                        >
                          ↑
                        </button>
                      </form>
                      <form action={moveCollectionAction}>
                        <input type="hidden" name="id" value={collection.id} />
                        <input type="hidden" name="direction" value="down" />
                        <button
                          type="submit"
                          disabled={index === collections.length - 1}
                          aria-label={`Move ${collection.name} down`}
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
                        href={`/admin/collections/${collection.id}`}
                        className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
                      >
                        Edit
                      </Link>
                      <form action={deleteCollectionAction}>
                        <input type="hidden" name="id" value={collection.id} />
                        <ConfirmSubmitButton
                          type="submit"
                          message={`Delete ${collection.name}?`}
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
