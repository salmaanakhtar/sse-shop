import Link from "next/link";
import { HomeSectionForm } from "@/components/admin/home-section-form";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import {
  createHomeSectionAction,
  deleteHomeSectionAction,
  moveHomeSectionAction,
  updateHomeSectionAction,
} from "@/server/actions/admin-home";
import { requireAdminPage } from "@/server/auth/guard";
import { listHomeSections } from "@/server/services/home-sections";
import { listPromotionRowOptions } from "@/server/services/promotions";

export const metadata = { title: "Homepage" };

const KIND_LABEL: Record<string, string> = {
  hero: "Hero",
  promotions: "Promotion carousel",
  collection: "Collection row",
  category: "Category row",
  text: "Text block",
  products: "Hand-picked products",
  allProducts: "All products",
};

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const [{ error }, sections, options] = await Promise.all([
    searchParams,
    listHomeSections(false),
    listPromotionRowOptions(),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Homepage</h1>
          <p className="mt-1 text-sm text-muted">
            Ordered sections. Inactive sections stay in this list but are hidden from shoppers.
          </p>
        </div>
        <Link href="/" className="text-sm text-muted hover:text-ink">
          View storefront
        </Link>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="space-y-3">
        {sections.map((section, index) => (
          <article key={section.id} className="rounded-xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                  {KIND_LABEL[section.kind] ?? section.kind}
                </p>
                <h2 className="mt-0.5 text-sm font-semibold">
                  {section.title || "(Untitled section)"}
                </h2>
                <p className="text-xs text-muted">
                  {section.active ? "Active" : "Inactive"} · position {section.position + 1}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <form action={moveHomeSectionAction}>
                  <input type="hidden" name="id" value={section.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button
                    type="submit"
                    disabled={index === 0}
                    aria-label={`Move ${section.title || "section"} up`}
                    className="flex size-7 items-center justify-center rounded border border-line text-xs text-muted hover:text-ink disabled:opacity-30"
                  >
                    ↑
                  </button>
                </form>
                <form action={moveHomeSectionAction}>
                  <input type="hidden" name="id" value={section.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button
                    type="submit"
                    disabled={index === sections.length - 1}
                    aria-label={`Move ${section.title || "section"} down`}
                    className="flex size-7 items-center justify-center rounded border border-line text-xs text-muted hover:text-ink disabled:opacity-30"
                  >
                    ↓
                  </button>
                </form>
                <form action={deleteHomeSectionAction}>
                  <input type="hidden" name="id" value={section.id} />
                  <ConfirmSubmitButton
                    type="submit"
                    message={`Delete ${section.title || "this section"}?`}
                    className="text-xs text-muted underline-offset-4 hover:text-red-600 hover:underline"
                  >
                    Delete
                  </ConfirmSubmitButton>
                </form>
              </div>
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-muted hover:text-ink">
                Edit section
              </summary>
              <div className="mt-3 border-t border-line pt-4">
                <HomeSectionForm
                  action={updateHomeSectionAction}
                  options={options}
                  values={section}
                  submitLabel="Save section"
                />
              </div>
            </details>
          </article>
        ))}

        {sections.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
            No sections yet. The storefront falls back to the built-in hero and product grid.
          </p>
        ) : null}
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold">Add a section</h2>
        <div data-testid="add-home-section">
          <HomeSectionForm
            action={createHomeSectionAction}
            options={options}
            submitLabel="Add section"
          />
        </div>
      </section>
    </div>
  );
}
