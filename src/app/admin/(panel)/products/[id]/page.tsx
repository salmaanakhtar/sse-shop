import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, buttonClass } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { formatMoney } from "@/lib/money";
import {
  addOptionAction,
  addOptionValueAction,
  deleteImageAction,
  deleteOptionAction,
  deleteOptionValueAction,
  generateVariantsAction,
  updateProductAction,
  updateVariantAction,
  uploadImageAction,
} from "@/server/actions/admin-products";
import { getProductForAdmin } from "@/server/services/catalog";

function moneyInput(minor: number): string {
  return (minor / 100).toFixed(2);
}

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
      <section className="rounded-xl border border-line bg-surface p-6">
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
            <Textarea id="description" name="description" rows={5} defaultValue={product.description} />
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
      <section className="rounded-xl border border-line bg-surface p-6">
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
          encType="multipart/form-data"
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
          <Button type="submit" size="sm" variant="secondary">
            Upload
          </Button>
        </form>
      </section>

      {/* ── options ─────────────────────────────────────────────── */}
      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="mb-1 text-sm font-semibold">Options</h2>
        <p className="mb-4 text-xs text-muted">
          Name the choices this product offers. Every combination becomes a variant.
        </p>

        <div className="space-y-4">
          {product.options.map((option) => (
            <div key={option.id} className="rounded-lg border border-line p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{option.name}</p>
                <form action={deleteOptionAction}>
                  <input type="hidden" name="productId" value={product.id} />
                  <input type="hidden" name="optionId" value={option.id} />
                  <button type="submit" className="text-xs text-muted hover:text-red-600">
                    Remove option
                  </button>
                </form>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {option.values.map((value) => (
                  <form key={value.id} action={deleteOptionValueAction}>
                    <input type="hidden" name="productId" value={product.id} />
                    <input type="hidden" name="valueId" value={value.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-line bg-page px-2 py-1 text-xs hover:border-red-300 hover:text-red-600"
                      title="Remove value"
                    >
                      {value.value} ×
                    </button>
                  </form>
                ))}
              </div>

              <form action={addOptionValueAction} className="mt-3 flex gap-2">
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name="optionId" value={option.id} />
                <Input
                  name="value"
                  placeholder="Add value, e.g. Medium"
                  className="max-w-56"
                  data-testid="add-option-value"
                />
                <Button type="submit" size="sm" variant="secondary" data-testid="add-option-value-submit">
                  Add
                </Button>
              </form>
            </div>
          ))}
        </div>

        <form action={addOptionAction} className="mt-4 flex gap-2">
          <input type="hidden" name="productId" value={product.id} />
          <Input
            name="name"
            placeholder="Add option, e.g. Size"
            className="max-w-56"
            data-testid="add-option-name"
          />
          <Button type="submit" size="sm" variant="secondary" data-testid="add-option">
            Add option
          </Button>
        </form>
      </section>

      {/* ── variants ────────────────────────────────────────────── */}
      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="mb-1 text-sm font-semibold">Variants</h2>
        <p className="mb-4 text-xs text-muted">
          One variant per option combination. Price and stock are per variant.
        </p>

        <form action={generateVariantsAction} className="mb-6 flex flex-wrap items-end gap-3">
          <input type="hidden" name="productId" value={product.id} />
          <div className="w-32">
            <Label htmlFor="price">Price (AED)</Label>
            <Input
              id="price"
              name="price"
              inputMode="decimal"
              placeholder="120.00"
              required
              data-testid="generate-price"
            />
          </div>
          <div className="w-28">
            <Label htmlFor="stock">Stock</Label>
            <Input
              id="stock"
              name="stock"
              type="number"
              min={0}
              defaultValue={10}
              required
              data-testid="generate-stock"
            />
          </div>
          <Button type="submit" size="sm" variant="secondary" data-testid="generate-variants">
            Generate missing variants
          </Button>
        </form>

        {product.variants.length === 0 ? (
          <p className="text-sm text-muted">
            No variants yet. Add options, then generate.
          </p>
        ) : (
          <div className="space-y-3">
            {product.variants.map((variant) => {
              const labels = product.options
                .map(
                  (option) =>
                    option.values.find((value) => variant.optionValueIds.includes(value.id))
                      ?.value,
                )
                .filter(Boolean)
                .join(" / ");

              return (
                <form
                  key={variant.id}
                  action={updateVariantAction}
                  className="flex flex-wrap items-end gap-3 rounded-lg border border-line p-3"
                >
                  <input type="hidden" name="productId" value={product.id} />
                  <input type="hidden" name="variantId" value={variant.id} />

                  <div className="min-w-40 flex-1">
                    <Label>Title</Label>
                    <Input name="title" defaultValue={variant.title} />
                    <p className="mt-1 text-xs text-muted">{labels || "No options"}</p>
                  </div>

                  <div className="w-36">
                    <Label>SKU</Label>
                    <Input name="sku" defaultValue={variant.sku} />
                  </div>

                  <div className="w-28">
                    <Label>Price (AED)</Label>
                    <Input
                      name="price"
                      inputMode="decimal"
                      defaultValue={moneyInput(variant.priceMinor)}
                      data-testid="variant-price"
                    />
                    <p className="mt-1 text-[11px] text-muted">{formatMoney(variant.priceMinor)}</p>
                  </div>

                  <div className="w-24">
                    <Label>Stock</Label>
                    <Input name="stock" type="number" min={0} defaultValue={variant.stockQty} />
                  </div>

                  <label className="flex h-10 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={variant.active}
                      className="size-4"
                    />
                    Active
                  </label>

                  <Button type="submit" size="sm" variant="secondary" data-testid="variant-save">
                    Save
                  </Button>
                </form>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
