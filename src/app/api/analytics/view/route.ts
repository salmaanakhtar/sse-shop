import { getAuthSession } from "@/server/auth/guard";
import { visitorHash } from "@/server/analytics/visitor";
import { checkRateLimit } from "@/server/security/rate-limit";
import { clientIp } from "@/server/security/request";
import { recordPageView } from "@/server/services/analytics";

export const dynamic = "force-dynamic";

/**
 * Accepts a storefront page-view beacon. The body is capped and the path is
 * validated in the service; no query string or referrer is stored.
 */
export async function POST(request: Request): Promise<Response> {
  const ip = await clientIp();
  const limit = await checkRateLimit(`analytics:${ip}`, 120, 60);
  if (!limit.ok) return new Response(null, { status: 429 });

  const raw = await request.text();
  if (raw.length > 2_048) return new Response(null, { status: 413 });

  let path: string;
  try {
    const parsed = JSON.parse(raw) as { path?: unknown };
    if (typeof parsed.path !== "string") return new Response(null, { status: 400 });
    path = parsed.path;
  } catch {
    return new Response(null, { status: 400 });
  }

  const session = await getAuthSession();
  const result = await recordPageView({
    path,
    visitorHash: await visitorHash(),
    userId: session?.user.id ?? null,
  }).catch((error) => {
    console.error("analytics view failed", error);
    return { ok: false as const, error: "Analytics unavailable." };
  });

  return new Response(null, { status: result.ok ? 204 : 400 });
}
