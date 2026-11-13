import Link from "next/link";
import { notFound } from "next/navigation";
import { CollectionForm } from "@/components/admin/collection-form";
import { Button, buttonClass } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import {
  addCollectionProductAction,
  deleteCollectionAction,
  moveCollectionProductAction,
  removeCollectionProductAction,
  updateCollectionAction,
} from "@/server/actions/admin-collections";
import { requireAdminPage } from "@/server/auth/guard";
import { listAdminProducts } from "@/server/services/catalog";
import {
  getCollection,
  listCollectionProductsForAdmin,
} from "@/server/services/collections";

export const metadata = { title: "Edit collection" };

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  draft: "bg-amber-50 text-amber-700",
  archived: "bg-zinc-100 text-zinc-600",
};

export default async function EditCollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const collection = await getCollection(id);
  if (!collection) notFound();

  const [selected, allProducts] = await Promise.all([
    listCollectionProductsForAdmin(id),
    listAdminProducts(),
  ]);

  const selectedIds = new Set(selected.map((product) => product.id));
  const available = allProducts.filter((product) => !selectedIds.has(product.id));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{collection.name}</h1>
          <p className="mt-1 text-xs text-muted">/collections/{collection.slug}</p>
        </div>
        <div className="flex items-center gap-3">
          {collection.active ? (
            <Link
              href={`/collections/${collection.slug}`}
              target="_blank"
              className={buttonClass("secondary", "sm")}
            >
              View in store
            </Link>
          ) : null}
          <Link href="/admin/collections" className="text-sm text-muted hover:text-ink">
            All collections
          </Link>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <CollectionForm
        action={updateCollectionAction}
        values={collection}
        submitLabel="Save collection"
      />

      <section
        id="products"
        className="scroll-mt-6 rounded-xl border border-line bg-surface p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Products</h2>
            <p className="mt-1 text-xs text-muted">
              The storefront shows these in this order. Only published products are visible.
            </p>
          </div>
          <span className="rounded-full bg-page px-2.5 py-1 text-xs text-muted">
            {selected.length} products
          </span>
        </div>

        <div className="mt-5 space-y-2">
          {selected.map((product, index) => (
            <div
              key={product.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-4 py-3"
            >
              <div className="min-w-0">
                <Link
                  href={`/admin/products/${product.id}`}
                  className="text-sm font-medium hover:text-brand"
                >
                  {product.title}
                </Link>
                <p className="text-xs text-muted">/{product.slug}</p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    STATUS_STYLE[product.status] ?? ""
                  }`}
                >
                  {product.status}
                </span>
                <form action={moveCollectionProductAction}>
                  <input type="hidden" name="collectionId" value={collection.id} />
                  <input type="hidden" name="productId" value={product.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button
                    type="submit"
                    disabled={index === 0}
                    aria-label={`Move ${product.title} up`}
                    className="flex size-7 items-center justify-center rounded border border-line text-xs text-muted hover:text-ink disabled:opacity-30"
                  >
                    ↑
                  </button>
                </form>
                <form action={moveCollectionProductAction}>
                  <input type="hidden" name="collectionId" value={collection.id} />
                  <input type="hidden" name="productId" value={product.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button
                    type="submit"
                    disabled={index === selected.length - 1}
                    aria-label={`Move ${product.title} down`}
                    className="flex size-7 items-center justify-center rounded border border-line text-xs text-muted hover:text-ink disabled:opacity-30"
                  >
                    ↓
                  </button>
                </form>
                <form action={removeCollectionProductAction}>
                  <input type="hidden" name="collectionId" value={collection.id} />
                  <input type="hidden" name="productId" value={product.id} />
                  <button
                    type="submit"
                    className="text-xs text-muted hover:text-red-600"
                  >
                    Remove
                  </button>
                </form>
              </div>
            </div>
          ))}

          {selected.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-4 py-6 text-sm text-muted">
              No products yet. Add the first one below.
            </p>
          ) : null}
        </div>

        {available.length > 0 ? (
          <form
            action={addCollectionProductAction}
            className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-5"
          >
            <input type="hidden" name="collectionId" value={collection.id} />
            <div className="min-w-56 flex-1">
              <label
                htmlFor="collection-product"
                className="mb-1.5 block text-xs font-semibold tracking-wide text-muted uppercase"
              >
                Add product
              </label>
              <select
                id="collection-product"
                name="productId"
                required
                defaultValue=""
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Choose a product
                </option>
                {available.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.title} ({product.status})
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm" variant="secondary">
              Add to collection
            </Button>
          </form>
        ) : (
          <p className="mt-5 border-t border-line pt-5 text-xs text-muted">
            Every product is already in this collection.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">Delete collection</h2>
        <p className="mt-2 text-sm text-muted">
          This removes the curated row, not its products. The audit log keeps the delete event.
        </p>
        <form action={deleteCollectionAction} className="mt-4">
          <input type="hidden" name="id" value={collection.id} />
          <ConfirmSubmitButton
            type="submit"
            message={`Delete ${collection.name}?`}
            className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Delete collection
          </ConfirmSubmitButton>
        </form>
      </section>
    </div>
  );
}
