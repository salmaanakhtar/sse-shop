import { NextResponse, type NextRequest } from "next/server";

/**
 * Routing only. The admin lives under /admin, and the admin host rewrites to
 * it. Authorization is enforced in every page and action by `requireAdmin*`:
 * Proxy has been the bypassed layer in real framework CVEs, so it never decides
 * who may do what.
 */
function isAdminHost(host: string | null): boolean {
  if (!host) return false;
  const name = host.split(":")[0] ?? "";
  return name === "admin.localhost" || name.startsWith("admin.");
}

export function proxy(request: NextRequest) {
  if (!isAdminHost(request.headers.get("host"))) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/admin${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|media).*)"],
};
