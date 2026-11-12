import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * One pool per process. In development Next reloads modules on every edit, so
 * the client is parked on globalThis rather than leaked on each reload.
 */
const globalForDb = globalThis as unknown as { __sseShopSql?: ReturnType<typeof postgres> };

function connect(): ReturnType<typeof postgres> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  }

  return postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

const sql = globalForDb.__sseShopSql ?? connect();
if (process.env.NODE_ENV !== "production") globalForDb.__sseShopSql = sql;

export const db = drizzle(sql, { schema });
export { sql, schema };
