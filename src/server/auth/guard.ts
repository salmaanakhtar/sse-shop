import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { env } from "@/lib/env";
import { auth } from "./index";

const requiresTwoFactor = env.ADMIN_REQUIRE_TWO_FACTOR === "true";

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
  if (requiresTwoFactor && !session.user.twoFactorEnabled) redirect("/admin/setup-2fa");

  return session;
}

/** Page guard for a signed-in shopper. Any account role may shop. */
export async function requireUserPage() {
  const session = await getAuthSession();

  if (!session) redirect("/account/sign-in");

  return session;
}

/** Action guard for a signed-in shopper. */
export async function requireUserAction() {
  const session = await getAuthSession();

  if (!session) {
    throw new Error("Sign in to continue.");
  }

  return session;
}

/** Action guard: throws rather than redirects, so the action returns an error. */
export async function requireAdminAction() {
  const session = await getAuthSession();

  if (!session || session.user.role !== "admin") {
    throw new Error("Not authorized.");
  }
  if (requiresTwoFactor && !session.user.twoFactorEnabled) {
    throw new Error("Two-factor authentication is required.");
  }

  return session;
}
