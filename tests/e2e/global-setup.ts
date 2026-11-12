import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

/**
 * One disposable database per run: migrate, seed, then clear everything a
 * previous run left behind (sessions, enrolled TOTP, orders, carts, and
 * products created by the admin specs). The seed is idempotent for catalog
 * data.
 */
export default async function globalSetup() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");

  execSync("pnpm db:migrate", { stdio: "inherit" });
  execSync("pnpm db:seed", { stdio: "inherit" });

  const { db, sql } = await import("../../src/server/db/client");
  const schema = await import("../../src/server/db/schema");
  const { like } = await import("drizzle-orm");

  await db.delete(schema.products).where(like(schema.products.slug, "playwright-%"));
  await db.delete(schema.sessions);
  await db.delete(schema.twoFactors);
  await db.update(schema.users).set({ twoFactorEnabled: false });
  await db.delete(schema.orders);
  await db.delete(schema.carts);

  await sql.end({ timeout: 5 });
}
