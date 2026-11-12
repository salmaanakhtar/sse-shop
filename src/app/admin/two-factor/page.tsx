import { AdminCard } from "@/components/admin/card";
import { TwoFactorForm } from "@/components/admin/two-factor-form";

export default function TwoFactorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <AdminCard>
        <h1 className="text-xl font-semibold tracking-tight">Two-step verification</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          Enter the code from your authenticator app.
        </p>
        <TwoFactorForm />
      </AdminCard>
    </div>
  );
}
