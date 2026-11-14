import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db/client";

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

/**
 * Fixed-window limiter backed by Postgres. The key is hashed so IP addresses
 * and email addresses are not stored verbatim.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  now = new Date(),
): Promise<RateLimitResult> {
  if (limit < 1 || windowSeconds < 1) {
    throw new Error("Rate limit and window must be positive.");
  }

  const expiresAt = new Date(now.getTime() + windowSeconds * 1000);
  const nowIso = now.toISOString();
  const expiresIso = expiresAt.toISOString();
  const hashedKey = createHash("sha256").update(key).digest("hex");

  const rows = await db.execute<{ count: number; expires_at: string | Date }>(sql`
    insert into rate_limits ("key", "count", "window_start", "expires_at")
    values (${hashedKey}, 1, ${nowIso}, ${expiresIso})
    on conflict ("key") do update set
      "count" = case
        when rate_limits."expires_at" <= ${nowIso} then 1
        else rate_limits."count" + 1
      end,
      "window_start" = case
        when rate_limits."expires_at" <= ${nowIso} then ${nowIso}
        else rate_limits."window_start"
      end,
      "expires_at" = case
        when rate_limits."expires_at" <= ${nowIso} then ${expiresIso}
        else rate_limits."expires_at"
      end
    returning "count", "expires_at"
  `);

  const row = rows[0];
  if (!row) return { ok: true };

  if (Number(row.count) <= limit) return { ok: true };

  const expires = new Date(row.expires_at).getTime();
  return {
    ok: false,
    retryAfterSeconds: Math.max(1, Math.ceil((expires - now.getTime()) / 1000)),
  };
}
