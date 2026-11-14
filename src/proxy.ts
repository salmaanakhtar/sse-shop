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
  const host = request.headers.get("host");
  const pathname = request.nextUrl.pathname;

  if (isAdminHost(host)) {
    if (pathname.startsWith("/admin") || pathname.startsWith("/api")) {
      return NextResponse.next();
    }

    const url = request.nextUrl.clone();
    url.pathname = `/admin${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  const isArabic = pathname === "/ar" || pathname.startsWith("/ar/");
  const headers = new Headers(request.headers);
  headers.set("x-store-locale", isArabic ? "ar" : "en");
  headers.set("x-store-pathname", pathname);

  if (!isArabic) {
    return NextResponse.next({ request: { headers } });
  }

  const url = request.nextUrl.clone();
  url.pathname = pathname === "/ar" ? "/" : pathname.slice(3) || "/";
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|media).*)"],
};
