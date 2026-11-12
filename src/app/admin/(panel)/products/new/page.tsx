import Link from "next/link";
import { Button, buttonClass } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { createProductAction } from "@/server/actions/admin-products";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">New product</h1>
        <Link href="/admin/products" className="text-sm text-muted hover:text-ink">
          Cancel
        </Link>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <form action={createProductAction} className="space-y-5 rounded-xl border border-line bg-surface p-6">
        <div>
          <Label htmlFor="title">Name</Label>
          <Input id="title" name="title" required autoFocus placeholder="Essential Tee" />
        </div>

        <div>
          <Label htmlFor="slug">URL slug (optional)</Label>
          <Input id="slug" name="slug" placeholder="essential-tee" />
          <p className="mt-1.5 text-xs text-muted">
            Leave empty to derive it from the name. Changing it later breaks old links.
          </p>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={5} placeholder="What it is, fabric, fit…" />
        </div>

        <input type="hidden" name="status" value="draft" />

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted">Saved as a draft. Publish when it is ready.</p>
          <Button type="submit">Create product</Button>
        </div>
      </form>

      <Link href="/admin/products" className={buttonClass("ghost", "sm")}>
        Back to products
      </Link>
    </div>
  );
}
