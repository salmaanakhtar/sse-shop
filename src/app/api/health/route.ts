import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";

/**
 * Liveness plus database readiness. Docker and uptime checks should never be
 * green while the store cannot reach Postgres.
 */
export async function GET(): Promise<Response> {
  try {
    await db.execute(sql`select 1`);
    return Response.json({
      status: "ok",
      database: "ok",
      uptimeSeconds: Math.round(process.uptime()),
    });
  } catch {
    return Response.json(
      {
        status: "degraded",
        database: "unreachable",
        uptimeSeconds: Math.round(process.uptime()),
      },
      { status: 503 },
    );
  }
}

export const dynamic = "force-dynamic";
