import { AdminCard } from "@/components/admin/card";
import { SignInForm } from "@/components/admin/sign-in-form";

export default function AdminSignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <AdminCard>
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">sse-shop</p>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Sign in to the admin</h1>
        <p className="mt-1 mb-6 text-sm text-muted">Staff access only.</p>
        <SignInForm />
      </AdminCard>
    </div>
  );
}
