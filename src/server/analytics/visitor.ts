import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { clientIp } from "../security/request";

/**
 * A daily pseudonym for analytics grouping. It rotates every day, includes no
 * raw address, and is scoped to this store with the auth secret as salt.
 */
export async function visitorHash(): Promise<string> {
  const store = await headers();
  const ip = await clientIp();
  const agent = store.get("user-agent") ?? "";
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.BETTER_AUTH_SECRET ?? "sse-shop-analytics";

  return createHash("sha256")
    .update(`${day}|${salt}|${ip}|${agent}`)
    .digest("hex")
    .slice(0, 40);
}
