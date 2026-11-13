import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, buttonClass } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { formatMoney } from "@/lib/money";
import { buildCombinations, combinationKey, describeVariant } from "@/lib/variants";
import {
  addOptionAction,
  addOptionValueAction,
  deleteImageAction,
  deleteOptionAction,
  deleteOptionValueAction,
  generateVariantsAction,
  moveOptionAction,
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

  const hasOptions = product.options.length > 0;
  const optionsComplete =
    hasOptions && product.options.every((option) => option.values.length > 0);
  const combinations = optionsComplete ? buildCombinations(product.options) : [];
  const existingKeys = new Set(
    product.variants.map((variant) => combinationKey(variant.optionValueIds)),
  );
  const missing = combinations.filter((combination) => !existingKeys.has(combination.key));
  const activeVariants = product.variants.filter((variant) => variant.active).length;

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
      <section id="images" className="rounded-xl border border-line bg-surface p-6">
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
          <Button type="submit" size="sm" variant="secondary">
            Upload
          </Button>
        </form>
      </section>

      {/* ── options ─────────────────────────────────────────────── */}
      <section id="options" className="scroll-mt-6 rounded-xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Options</h2>
            <p className="mt-1 max-w-2xl text-xs text-muted">
              Options are the choices a shopper picks, in order. Each value combines with every
              value in the other options to make a variant. Removing an option or value removes the
              variants built from it; past orders keep their snapshots.
            </p>
          </div>
          <span className="rounded-full bg-page px-2.5 py-1 text-xs text-muted">
            {product.options.length} of 3 options
          </span>
        </div>

        <div className="mt-5 space-y-4">
          {product.options.map((option, index) => (
            <div key={option.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                    Option {index + 1}
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
                      disabled={index === 0}
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
                      disabled={index === product.options.length - 1}
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
                    Add at least one value to use this option.
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
              No options yet. Add the first choice, such as Spec or Colour.
            </div>
          ) : null}
        </div>

        {product.options.length < 3 ? (
          <div className="mt-5 rounded-xl border border-dashed border-line p-4">
            <p className="text-sm font-medium">Add another option</p>
            <p className="mt-1 text-xs text-muted">
              The order above is the order the storefront shows. Put the choice you want first at
              the top.
            </p>
            <form action={addOptionAction} className="mt-3 flex gap-2">
              <input type="hidden" name="productId" value={product.id} />
              <Input
                name="name"
                placeholder="e.g. Colour"
                aria-label="New option name"
                className="max-w-56"
                data-testid="add-option-name"
              />
              <Button type="submit" size="sm" variant="secondary" data-testid="add-option">
                Add option
              </Button>
            </form>
          </div>
        ) : (
          <p className="mt-5 text-xs text-muted">Three options is the practical limit.</p>
        )}
      </section>

      {/* ── variants ────────────────────────────────────────────── */}
      <section id="variants" className="scroll-mt-6 rounded-xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Variants</h2>
            <p className="mt-1 max-w-2xl text-xs text-muted">
              One variant per combination of option values. SKU, price, stock, and active state
              belong to the variant, not to the product. Uncheck Active to hide a combination
              without deleting it.
            </p>
          </div>
          <span className="rounded-full bg-page px-2.5 py-1 text-xs text-muted">
            {product.variants.length} variants · {activeVariants} active
          </span>
        </div>

        {!hasOptions ? (
          <div className="mt-5 rounded-xl border border-dashed border-line px-4 py-6 text-sm text-muted">
            Add an option above first. Variants are built from the option values.
          </div>
        ) : !optionsComplete ? (
          <p className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Add a value to every option to see the combinations.
          </p>
        ) : (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-line p-3">
                <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                  Options
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {product.options.length}
                </p>
              </div>
              <div className="rounded-lg border border-line p-3">
                <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                  Combinations
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {combinations.length}
                </p>
              </div>
              <div className="rounded-lg border border-line p-3">
                <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                  Generated
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {product.variants.length}
                </p>
              </div>
              <div
                className={`rounded-lg border p-3 ${
                  missing.length > 0
                    ? "border-amber-200 bg-amber-50"
                    : "border-emerald-200 bg-emerald-50"
                }`}
              >
                <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                  Missing
                </p>
                <p
                  className={`mt-1 text-lg font-semibold tabular-nums ${
                    missing.length > 0 ? "text-amber-800" : "text-emerald-700"
                  }`}
                >
                  {missing.length}
                </p>
              </div>
            </div>

            {missing.length > 0 ? (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <p className="text-sm font-semibold">
                  Create {missing.length} missing variant{missing.length === 1 ? "" : "s"}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Base price and stock for the new rows. Existing variants are left untouched.
                </p>

                <form
                  action={generateVariantsAction}
                  className="mt-3 flex flex-wrap items-end gap-3"
                >
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
                  <Button
                    type="submit"
                    size="sm"
                    variant="secondary"
                    data-testid="generate-variants"
                  >
                    Generate missing variants
                  </Button>
                </form>

                {missing.length <= 12 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {missing.map((combination) => (
                      <span
                        key={combination.key}
                        className="rounded-full border border-amber-200 bg-surface px-2 py-0.5 text-xs text-amber-800"
                      >
                        {combination.labels.join(" / ")}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Every combination has a variant.
              </p>
            )}

            {product.variants.length === 0 ? (
              <p className="mt-4 text-sm text-muted">
                No variants yet. Generate the missing combinations above.
              </p>
            ) : (
              <div className="mt-5">
                <div className="hidden gap-3 px-3 pb-2 text-[11px] font-semibold tracking-wide text-muted uppercase lg:grid lg:grid-cols-[minmax(0,1.8fr)_9rem_9rem_7rem_6rem_auto]">
                  <span>Combination</span>
                  <span>SKU</span>
                  <span>Price</span>
                  <span>Stock</span>
                  <span>Active</span>
                  <span />
                </div>

                <div className="space-y-3">
                  {product.variants.map((variant) => {
                    const labels = describeVariant(product.options, variant.optionValueIds);

                    return (
                      <form
                        key={variant.id}
                        action={updateVariantAction}
                        className="grid gap-3 rounded-xl border border-line p-3 lg:grid-cols-[minmax(0,1.8fr)_9rem_9rem_7rem_6rem_auto] lg:items-start"
                      >
                        <input type="hidden" name="productId" value={product.id} />
                        <input type="hidden" name="variantId" value={variant.id} />

                        <div>
                          <Label className="lg:hidden">Combination</Label>
                          <div className="flex flex-wrap gap-1.5">
                            {labels.length > 0 ? (
                              labels.map((label) => (
                                <span
                                  key={label}
                                  className="rounded-full bg-page px-2 py-0.5 text-xs"
                                >
                                  {label}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-muted">No options</span>
                            )}
                          </div>

                          <div className="mt-2">
                            <Label htmlFor={`variant-title-${variant.id}`}>Order title</Label>
                            <Input
                              id={`variant-title-${variant.id}`}
                              name="title"
                              defaultValue={variant.title}
                            />
                            <p className="mt-1 text-[11px] text-muted">Shown on order lines.</p>
                          </div>
                        </div>

                        <div>
                          <Label htmlFor={`variant-sku-${variant.id}`}>SKU</Label>
                          <Input
                            id={`variant-sku-${variant.id}`}
                            name="sku"
                            defaultValue={variant.sku}
                          />
                        </div>

                        <div>
                          <Label htmlFor={`variant-price-${variant.id}`}>Price (AED)</Label>
                          <Input
                            id={`variant-price-${variant.id}`}
                            name="price"
                            inputMode="decimal"
                            defaultValue={moneyInput(variant.priceMinor)}
                            data-testid="variant-price"
                          />
                          <p className="mt-1 text-[11px] text-muted">
                            {formatMoney(variant.priceMinor)}
                          </p>
                        </div>

                        <div>
                          <Label htmlFor={`variant-stock-${variant.id}`}>Stock</Label>
                          <Input
                            id={`variant-stock-${variant.id}`}
                            name="stock"
                            type="number"
                            min={0}
                            defaultValue={variant.stockQty}
                          />
                        </div>

                        <label className="flex h-10 items-center gap-2 text-sm lg:mt-5">
                          <input
                            type="checkbox"
                            name="active"
                            defaultChecked={variant.active}
                            className="size-4"
                          />
                          Active
                        </label>

                        <div className="lg:mt-5">
                          <Button
                            type="submit"
                            size="sm"
                            variant="secondary"
                            data-testid="variant-save"
                          >
                            Save
                          </Button>
                        </div>
                      </form>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
