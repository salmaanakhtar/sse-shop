import Link from "next/link";
import { PromotionForm } from "@/components/admin/promotion-form";
import { createPromotionAction } from "@/server/actions/admin-promotions";
import { requireAdminPage } from "@/server/auth/guard";

export const metadata = { title: "New promotion" };

export default async function NewPromotionPage({
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
          <h1 className="text-xl font-semibold tracking-tight">New slide</h1>
          <p className="mt-1 text-sm text-muted">
            This appears in the home-page carousel. Only live slides are shown.
          </p>
        </div>
        <Link href="/admin/promotions" className="text-sm text-muted hover:text-ink">
          Cancel
        </Link>
      </div>

      <PromotionForm
        action={createPromotionAction}
        submitLabel="Create slide"
        error={error}
        showImage
      />
    </div>
  );
}
