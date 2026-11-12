/**
 * Liveness only. Once the data layer is live this also reports database
 * readiness; a health check that cannot see the database would be a lie.
 */
export function GET(): Response {
  return Response.json({
    status: "ok",
    uptimeSeconds: Math.round(process.uptime()),
  });
}

export const dynamic = "force-dynamic";
