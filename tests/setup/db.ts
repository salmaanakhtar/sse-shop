import { sql } from "drizzle-orm";
import { afterAll, beforeAll } from "vitest";

/**
 * Integration tests run against a real Postgres, never a mock.
 * DATABASE_URL_TEST must point at a disposable database — this file truncates it.
 */
const TRUNCATE_ORDER = [
  "order_items",
  "orders",
  "cart_items",
  "carts",
  "variant_option_values",
  "product_option_values",
  "product_options",
  "product_media",
  "variants",
  "products",
  "audit_log",
  "settings",
  "two_factors",
  "sessions",
  "accounts",
  "verifications",
  "users",
];

let close: (() => Promise<void>) | undefined;

beforeAll(async () => {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error("DATABASE_URL_TEST must point at a disposable database");
  }
  process.env.DATABASE_URL = url;

  const client = await import("@/server/db/client");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");

  await migrate(client.db, { migrationsFolder: "./drizzle" });
  await client.db.execute(
    sql.raw(`truncate ${TRUNCATE_ORDER.join(", ")} restart identity cascade`),
  );

  close = async () => {
    await client.sql.end({ timeout: 5 });
  };
});

afterAll(async () => {
  await close?.();
});
