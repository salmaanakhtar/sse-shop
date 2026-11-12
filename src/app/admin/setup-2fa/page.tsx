import { redirect } from "next/navigation";
import { AdminCard } from "@/components/admin/card";
import { SetupTwoFactorForm } from "@/components/admin/setup-two-factor-form";
import { getAuthSession } from "@/server/auth/guard";

export default async function SetupTwoFactorPage() {
  const session = await getAuthSession();

  if (!session) redirect("/admin/sign-in");
  if (session.user.role !== "admin") redirect("/");
  if (session.user.twoFactorEnabled) redirect("/admin");

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <AdminCard>
        <h1 className="text-xl font-semibold tracking-tight">Secure your account</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          Signed in as {session.user.email}.
        </p>
        <SetupTwoFactorForm />
      </AdminCard>
    </div>
  );
}
