import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PromotionForm } from "@/components/admin/promotion-form";
import { PromotionRowForm } from "@/components/admin/promotion-row-form";
import { PromotionRowProductsForm } from "@/components/admin/promotion-row-products-form";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input, Label } from "@/components/ui/field";
import {
  deletePromotionAction,
  deletePromotionRowAction,
  movePromotionRowAction,
  removePromotionRowProductAction,
  replacePromotionImageAction,
  updatePromotionAction,
  updatePromotionRowTitleAction,
} from "@/server/actions/admin-promotions";
import { formatDubaiDateTime } from "@/lib/dates";
import { requireAdminPage } from "@/server/auth/guard";
import {
  getPromotion,
  listPromotionRowOptions,
  listPromotionRows,
} from "@/server/services/promotions";

export const metadata = { title: "Edit promotion" };

const KIND_LABEL: Record<string, string> = {
  category: "Category row",
  collection: "Collection row",
  products: "Product row",
};

export default async function EditPromotionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const promotion = await getPromotion(id);
  if (!promotion) notFound();

  const [rows, options] = await Promise.all([
    listPromotionRows(id),
    listPromotionRowOptions(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {promotion.headline || "Untitled promotion"}
          </h1>
          <p className="mt-1 text-xs text-muted capitalize">{promotion.status}</p>
          <p className="mt-1 text-xs text-muted">
            Page: {promotion.href}
          </p>
          {promotion.startsAt || promotion.endsAt ? (
            <p className="mt-1 text-xs text-muted">
              {formatDubaiDateTime(promotion.startsAt) || "Open"} →{" "}
              {formatDubaiDateTime(promotion.endsAt) || "Open"}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {promotion.active ? (
            <Link
              href={promotion.href}
              target="_blank"
              className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              View page
            </Link>
          ) : null}
          <Link href="/admin/promotions" className="text-sm text-muted hover:text-ink">
            All promotions
          </Link>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <PromotionForm
        action={updatePromotionAction}
        values={promotion}
        submitLabel="Save promotion"
      />

      <section
        id="rows"
        className="scroll-mt-6 space-y-4 rounded-xl border border-line bg-surface p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Page rows</h2>
            <p className="mt-1 max-w-2xl text-xs text-muted">
              A category, a collection, or hand-picked products. The storefront hides an empty
              row. The same category or collection cannot be added twice.
            </p>
          </div>
          <span className="rounded-full bg-page px-2.5 py-1 text-xs text-muted">
            {rows.length} {rows.length === 1 ? "row" : "rows"}
          </span>
        </div>

        <div className="space-y-3">
          {rows.map((row, index) => (
            <article key={row.id} className="space-y-3 rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                    {KIND_LABEL[row.kind]}
                  </p>
                  <h3 className="mt-0.5 text-sm font-semibold">{row.title}</h3>
                  <p className="text-xs text-muted">
                    {row.sourceLabel}
                    {row.kind === "products"
                      ? ` · ${row.products.length} ${row.products.length === 1 ? "product" : "products"}`
                      : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <form action={movePromotionRowAction}>
                    <input type="hidden" name="promotionId" value={promotion.id} />
                    <input type="hidden" name="rowId" value={row.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button
                      type="submit"
                      disabled={index === 0}
                      aria-label={`Move ${row.title} up`}
                      className="flex size-7 items-center justify-center rounded border border-line text-xs text-muted hover:text-ink disabled:opacity-30"
                    >
                      ↑
                    </button>
                  </form>
                  <form action={movePromotionRowAction}>
                    <input type="hidden" name="promotionId" value={promotion.id} />
                    <input type="hidden" name="rowId" value={row.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button
                      type="submit"
                      disabled={index === rows.length - 1}
                      aria-label={`Move ${row.title} down`}
                      className="flex size-7 items-center justify-center rounded border border-line text-xs text-muted hover:text-ink disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </form>
                  <form action={deletePromotionRowAction}>
                    <input type="hidden" name="promotionId" value={promotion.id} />
                    <input type="hidden" name="rowId" value={row.id} />
                    <ConfirmSubmitButton
                      type="submit"
                      message={`Delete the ${row.title} row?`}
                      className="text-xs text-muted underline-offset-4 hover:text-red-600 hover:underline"
                    >
                      Delete
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </div>

              <form
                action={updatePromotionRowTitleAction}
                className="flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="promotionId" value={promotion.id} />
                <input type="hidden" name="rowId" value={row.id} />
                <div className="min-w-52 flex-1">
                  <Label htmlFor={`row-title-${row.id}`}>Row heading</Label>
                  <Input
                    id={`row-title-${row.id}`}
                    name="title"
                    required
                    maxLength={80}
                    defaultValue={row.title}
                  />
                </div>
                <Button type="submit" size="sm" variant="secondary">
                  Save heading
                </Button>
              </form>

              {row.kind === "products" ? (
                <div className="space-y-2 border-t border-line pt-3">
                  {row.products.map((product) => (
                    <div
                      key={product.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <div>
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="font-medium hover:text-brand"
                        >
                          {product.title}
                        </Link>
                        <span className="ml-2 text-xs text-muted capitalize">
                          {product.status}
                        </span>
                      </div>
                      <form action={removePromotionRowProductAction}>
                        <input type="hidden" name="promotionId" value={promotion.id} />
                        <input type="hidden" name="rowId" value={row.id} />
                        <input type="hidden" name="productId" value={product.id} />
                        <button
                          type="submit"
                          className="text-xs text-muted hover:text-red-600"
                        >
                          Remove
                        </button>
                      </form>
                    </div>
                  ))}

                  <PromotionRowProductsForm
                    promotionId={promotion.id}
                    rowId={row.id}
                    products={options.products.filter(
                      (product) => !row.products.some((item) => item.id === product.id),
                    )}
                  />
                </div>
              ) : null}
            </article>
          ))}

          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-4 py-6 text-sm text-muted">
              No rows yet. Add the first category, collection, or product row below.
            </p>
          ) : null}
        </div>

        <div className="border-t border-line pt-5">
          <h3 className="mb-3 text-sm font-semibold">Add a row</h3>
          <PromotionRowForm
            promotionId={promotion.id}
            options={options}
            usedCategoryIds={rows
              .map((row) => row.categoryId)
              .filter((id): id is string => Boolean(id))}
            usedCollectionIds={rows
              .map((row) => row.collectionId)
              .filter((id): id is string => Boolean(id))}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">Image</h2>
        <Image
          src={`/media/${promotion.imageKey}`}
          alt={promotion.imageAlt || promotion.headline || "Promotion"}
          width={640}
          height={320}
          className="aspect-[2/1] w-full rounded-lg border border-line object-cover"
        />
        <form action={replacePromotionImageAction} className="space-y-3">
          <input type="hidden" name="id" value={promotion.id} />
          <div>
            <Label htmlFor="replacement-image">Replace image</Label>
            <input
              id="replacement-image"
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              required
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-page file:px-3 file:py-1.5 file:text-sm"
            />
          </div>
          <div>
            <Label htmlFor="replacement-alt">Alt text</Label>
            <Input
              id="replacement-alt"
              name="imageAlt"
              maxLength={160}
              defaultValue={promotion.imageAlt}
            />
          </div>
          <Button type="submit" size="sm" variant="secondary">
            Replace image
          </Button>
        </form>
      </section>

      <section className="rounded-xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold">Delete promotion</h2>
        <p className="mt-2 text-sm text-muted">
          This removes the slide, its page, rows, and image. The audit log keeps the delete event.
        </p>
        <form action={deletePromotionAction} className="mt-4">
          <input type="hidden" name="id" value={promotion.id} />
          <ConfirmSubmitButton
            type="submit"
            message="Delete this promotion?"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Delete promotion
          </ConfirmSubmitButton>
        </form>
      </section>
    </div>
  );
}
