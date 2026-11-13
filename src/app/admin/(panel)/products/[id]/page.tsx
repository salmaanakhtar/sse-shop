import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VariantTreeEditor } from "@/components/admin/variant-tree";
import { Button, buttonClass } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import {
  addOptionAction,
  addOptionValueAction,
  deleteImageAction,
  deleteOptionAction,
  deleteOptionValueAction,
  moveOptionAction,
  updateProductAction,
  uploadImageAction,
} from "@/server/actions/admin-products";
import { getProductForAdmin } from "@/server/services/catalog";

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const product = await getProductForAdmin(id);

  if (!product) notFound();

  const hasTree = product.nodes.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{product.title}</h1>
          <p className="text-xs text-muted">
            /products/{product.slug} ·{" "}
            <span className="capitalize">{product.status}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {product.status === "active" ? (
            <Link
              href={`/products/${product.slug}`}
              className={buttonClass("secondary", "sm")}
              target="_blank"
            >
              View in store
            </Link>
          ) : null}
          <Link href="/admin/products" className={buttonClass("ghost", "sm")}>
            All products
          </Link>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {/* ── details ─────────────────────────────────────────────── */}
      <section id="details" className="scroll-mt-6 rounded-xl border border-line bg-surface p-6">
        <h2 className="mb-4 text-sm font-semibold">Details</h2>

        <form action={updateProductAction} className="space-y-4">
          <input type="hidden" name="id" value={product.id} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="title">Name</Label>
              <Input id="title" name="title" required defaultValue={product.title} />
            </div>
            <div>
              <Label htmlFor="slug">URL slug</Label>
              <Input id="slug" name="slug" required defaultValue={product.slug} />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={5}
              defaultValue={product.description}
            />
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              defaultValue={product.status}
              className="w-full max-w-xs rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            >
              <option value="draft">Draft — hidden from the store</option>
              <option value="active">Published — visible to shoppers</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <Button type="submit" size="sm">
            Save details
          </Button>
        </form>
      </section>

      {/* ── media ───────────────────────────────────────────────── */}
      <section id="images" className="scroll-mt-6 rounded-xl border border-line bg-surface p-6">
        <h2 className="mb-1 text-sm font-semibold">Images</h2>
        <p className="mb-4 text-xs text-muted">
          Re-encoded to WebP, 1600px wide, metadata stripped. The first image is the main one.
        </p>

        <div className="flex flex-wrap gap-4">
          {product.media.map((media) => (
            <div key={media.id} className="w-32 space-y-2">
              <div className="relative aspect-square overflow-hidden rounded-lg border border-line bg-page">
                <Image
                  src={`/media/${media.storageKey}`}
                  alt={media.alt || product.title}
                  fill
                  sizes="128px"
                  className="object-cover"
                />
              </div>
              <form action={deleteImageAction}>
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="mediaId" value={media.id} />
                <button type="submit" className="text-xs text-muted hover:text-red-600">
                  Remove
                </button>
              </form>
            </div>
          ))}

          {product.media.length === 0 ? (
            <p className="text-sm text-muted">No images yet.</p>
          ) : null}
        </div>

        <form
          action={uploadImageAction}
          className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-5"
        >
          <input type="hidden" name="productId" value={product.id} />
          <div>
            <Label htmlFor="image">Add image</Label>
            <input
              id="image"
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              required
              className="block text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-page file:px-3 file:py-1.5 file:text-sm"
            />
          </div>
          <div className="w-48">
            <Label htmlFor="alt">Alt text</Label>
            <Input id="alt" name="alt" placeholder="Black tee, front" />
          </div>
          <Button type="submit" size="sm" variant="secondary" data-testid="upload-product-image">
            Upload
          </Button>
        </form>
      </section>

      {/* ── levels ──────────────────────────────────────────────── */}
      <section id="options" className="scroll-mt-6 rounded-xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Levels and values</h2>
            <p className="mt-1 max-w-2xl text-xs text-muted">
              Define the levels in the order shoppers choose them. The tree below creates only the
              branches you add. Removing a level or value removes its branches; past orders keep
              their snapshots.
            </p>
          </div>
          <span className="rounded-full bg-page px-2.5 py-1 text-xs text-muted">
            {product.options.length} levels
          </span>
        </div>

        <div className="mt-5 space-y-4">
          {product.options.map((option, index) => (
            <div key={option.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                    Level {index + 1}
                  </p>
                  <p className="text-sm font-semibold">{option.name}</p>
                </div>

                <div className="flex items-center gap-1">
                  <form action={moveOptionAction}>
                    <input type="hidden" name="productId" value={product.id} />
                    <input type="hidden" name="optionId" value={option.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button
                      type="submit"
                      disabled={hasTree || index === 0}
                      aria-label={`Move ${option.name} up`}
                      className="flex size-8 items-center justify-center rounded-md border border-line text-sm text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      ↑
                    </button>
                  </form>
                  <form action={moveOptionAction}>
                    <input type="hidden" name="productId" value={product.id} />
                    <input type="hidden" name="optionId" value={option.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button
                      type="submit"
                      disabled={hasTree || index === product.options.length - 1}
                      aria-label={`Move ${option.name} down`}
                      className="flex size-8 items-center justify-center rounded-md border border-line text-sm text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </form>
                  <form action={deleteOptionAction}>
                    <input type="hidden" name="productId" value={product.id} />
                    <input type="hidden" name="optionId" value={option.id} />
                    <button type="submit" className="ml-2 text-xs text-muted hover:text-red-600">
                      Remove
                    </button>
                  </form>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {option.values.map((value) => (
                  <form key={value.id} action={deleteOptionValueAction}>
                    <input type="hidden" name="productId" value={product.id} />
                    <input type="hidden" name="valueId" value={value.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-line bg-page px-2 py-1 text-xs hover:border-red-300 hover:text-red-600"
                      title={`Remove ${value.value}`}
                    >
                      {value.value} ×
                    </button>
                  </form>
                ))}
                {option.values.length === 0 ? (
                  <p className="text-xs text-amber-700">
                    Add at least one value to use this level.
                  </p>
                ) : null}
              </div>

              <form action={addOptionValueAction} className="mt-3 flex gap-2">
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="optionId" value={option.id} />
                <Input
                  name="value"
                  placeholder={`Add a ${option.name.toLowerCase()} value`}
                  aria-label={`Add a value to ${option.name}`}
                  className="max-w-56"
                  data-testid="add-option-value"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  data-testid="add-option-value-submit"
                >
                  Add value
                </Button>
              </form>
            </div>
          ))}

          {product.options.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-muted">
              No levels yet. Add the first choice, such as Colour or Size.
            </div>
          ) : null}
        </div>

        {!hasTree ? (
          <div className="mt-5 rounded-xl border border-dashed border-line p-4">
            <p className="text-sm font-medium">Add another level</p>
            <p className="mt-1 text-xs text-muted">
              Levels are shared names; each parent can still choose its own values in the tree.
              Reorder levels before you add branches.
            </p>
            <form action={addOptionAction} className="mt-3 flex gap-2">
              <input type="hidden" name="productId" value={product.id} />
              <Input
                name="name"
                placeholder="e.g. Size"
                aria-label="New level name"
                className="max-w-56"
                data-testid="add-option-name"
              />
              <Button type="submit" size="sm" variant="secondary" data-testid="add-option">
                Add level
              </Button>
            </form>
          </div>
        ) : (
          <p className="mt-5 rounded-lg bg-page px-4 py-3 text-xs text-muted">
            Levels are locked while the tree has branches. Delete branches in the tree below to
            change the level order or add a level.
          </p>
        )}
      </section>

      {/* ── variant tree ────────────────────────────────────────── */}
      <section id="variants" className="scroll-mt-6 rounded-xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Variant tree</h2>
            <p className="mt-1 max-w-2xl text-xs text-muted">
              Add a branch only when it exists. Parents can hold images and defaults; leaves own the
              real SKU, price, and stock. A missing combination is never created.
            </p>
          </div>
          <span className="rounded-full bg-page px-2.5 py-1 text-xs text-muted">
            {product.nodes.length} branches
          </span>
        </div>

        <VariantTreeEditor productId={product.id} levels={product.options} nodes={product.nodes} />
      </section>
    </div>
  );
}
