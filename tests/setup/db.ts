import { sql } from "drizzle-orm";
import { afterAll, beforeAll } from "vitest";

/**
 * Integration tests run against a real Postgres, never a mock.
 * DATABASE_URL_TEST must point at a disposable database — this file truncates it.
 *
 * The assignment happens at module load, before test files import the database
 * client, so every service in the run connects to the test database.
 */
const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) {
  throw new Error("DATABASE_URL_TEST must point at a disposable database");
}
process.env.DATABASE_URL = testUrl;

const TRUNCATE_ORDER = [
  "order_events",
  "refunds",
  "order_items",
  "orders",
  "cart_items",
  "carts",
  "customer_addresses",
  "wishlist_alerts",
  "wishlist_items",
  "wishlists",
  "home_sections",
  "pages",
  "promotions",
  "product_badges",
  "collection_products",
  "product_categories",
  "badges",
  "collections",
  "categories",
  "variant_nodes",
  "product_option_values",
  "product_options",
  "product_media",
  "product_reviews",
  "variants",
  "products",
  "audit_log",
  "settings",
  "two_factors",
  "sessions",
  "accounts",
  "verifications",
  "users",
  "counters",
  "rate_limits",
];

let close: (() => Promise<void>) | undefined;

beforeAll(async () => {
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
