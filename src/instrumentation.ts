/**
 * Runs pending Drizzle migrations when the production server boots. The
 * standalone image does not ship the CLI or the `postgres` package separately,
 * so the migrator has to live inside the Next server bundle. This is a no-op
 * during `next build` and in local development unless RUN_MIGRATIONS is set.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.RUN_MIGRATIONS !== "true") return;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required to run migrations.");

  const postgres = (await import("postgres")).default;
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");

  const client = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    console.info("database migrations applied");
  } finally {
    await client.end({ timeout: 5 });
  }
}
