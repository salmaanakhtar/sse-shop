import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "./index";

export async function getAuthSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Page guard. Middleware routes the admin host, but every page and action
 * re-checks identity and role here — middleware is not an authorization
 * boundary.
 */
export async function requireAdminPage() {
  const session = await getAuthSession();

  if (!session) redirect("/admin/sign-in");
  if (session.user.role !== "admin") notFound();
  if (!session.user.twoFactorEnabled) redirect("/admin/setup-2fa");

  return session;
}

/** Action guard: throws rather than redirects, so the action returns an error. */
export async function requireAdminAction() {
  const session = await getAuthSession();

  if (!session || session.user.role !== "admin") {
    throw new Error("Not authorized.");
  }
  if (!session.user.twoFactorEnabled) {
    throw new Error("Two-factor authentication is required.");
  }

  return session;
}
