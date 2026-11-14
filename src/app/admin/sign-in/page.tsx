import { AdminCard } from "@/components/admin/card";
import { SignInForm } from "@/components/admin/sign-in-form";

export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <AdminCard>
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">sse-shop</p>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Sign in to the admin</h1>
        <p className="mt-1 mb-6 text-sm text-muted">Staff access only.</p>
        {expired ? (
          <p role="alert" className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your admin session expired after 8 hours. Sign in again.
          </p>
        ) : null}
        <SignInForm />
      </AdminCard>
    </div>
  );
}
