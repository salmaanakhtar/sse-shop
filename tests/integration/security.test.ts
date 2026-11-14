import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/server/security/rate-limit";

describe("rate limits", () => {
  it("allows the limit then blocks the next request", async () => {
    const key = `test:${Date.now()}:${Math.random()}`;
    const now = new Date("2026-06-01T12:00:00.000Z");

    expect(await checkRateLimit(key, 2, 60, now)).toEqual({ ok: true });
    expect(await checkRateLimit(key, 2, 60, now)).toEqual({ ok: true });

    const blocked = await checkRateLimit(key, 2, 60, now);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("starts a fresh window after expiry", async () => {
    const key = `test:${Date.now()}:${Math.random()}`;
    const now = new Date("2026-06-01T12:00:00.000Z");

    expect(await checkRateLimit(key, 1, 10, now)).toEqual({ ok: true });
    expect((await checkRateLimit(key, 1, 10, now)).ok).toBe(false);

    const later = new Date(now.getTime() + 11_000);
    expect(await checkRateLimit(key, 1, 10, later)).toEqual({ ok: true });
  });

  it("keeps keys independent", async () => {
    const base = `test:${Date.now()}:${Math.random()}`;
    const now = new Date("2026-06-01T12:00:00.000Z");

    expect(await checkRateLimit(`${base}:a`, 1, 60, now)).toEqual({ ok: true });
    expect(await checkRateLimit(`${base}:b`, 1, 60, now)).toEqual({ ok: true });
  });
});
