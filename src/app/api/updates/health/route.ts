import {
  listProductUpdateHealth,
  productUpdatesSchemaReady
} from "@/lib/product-updates/repositories";

export const dynamic = "force-dynamic";

function productUpdateHealthReasons(
  source: Awaited<ReturnType<typeof listProductUpdateHealth>>[number],
  now = new Date()
) {
  const reasons: string[] = [];
  if (source.status !== "active") reasons.push(`status:${source.status}`);
  if (!source.lastSuccessAt) reasons.push("never-succeeded");
  if (source.consecutiveFailures > 0) reasons.push("recent-failures");
  if (
    source.circuitOpenUntil !== null &&
    new Date(source.circuitOpenUntil) > now
  ) {
    reasons.push("circuit-open");
  }
  if (
    source.nextDueAt &&
    new Date(source.nextDueAt).getTime() +
      Math.max(60 * 60_000, source.cadenceHours * 15 * 60_000) <
      now.getTime()
  ) {
    reasons.push("overdue");
  }
  if (
    source.leaseExpiresAt !== null &&
    new Date(source.leaseExpiresAt) < now
  ) {
    reasons.push("expired-lease");
  }
  return reasons;
}

export async function GET() {
  if (!(await productUpdatesSchemaReady())) {
    return Response.json({
      configured: false,
      status: "not-configured",
      sources: []
    });
  }
  const sources = await listProductUpdateHealth();
  const evaluatedSources = sources.map((source) => {
    const healthReasons = productUpdateHealthReasons(source);
    return {
      ...source,
      health: healthReasons.length > 0 ? "degraded" : "ok",
      healthReasons
    };
  });
  return Response.json({
    configured: true,
    ingestionEnabled: process.env.PRODUCT_UPDATE_INGEST_ENABLED === "true",
    status:
      evaluatedSources.length === 0 ||
      evaluatedSources.some((source) => source.health === "degraded")
        ? "degraded"
        : "ok",
    sources: evaluatedSources
  });
}
