import { headers } from "next/headers";

/** Caddy sets X-Forwarded-For; fall back to the proxy header or a shared key. */
export async function clientIp(): Promise<string> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return store.get("x-real-ip") ?? "unknown";
}
