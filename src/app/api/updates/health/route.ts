import {
  listProductUpdateHealth,
  productUpdatesSchemaReady
} from "@/lib/product-updates/repositories";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await productUpdatesSchemaReady())) {
    return Response.json({
      configured: false,
      status: "not-configured",
      sources: []
    });
  }
  const sources = await listProductUpdateHealth();
  const degraded = sources.filter(
    (source) =>
      source.status !== "active" ||
      source.consecutiveFailures > 0 ||
      (source.circuitOpenUntil !== null && new Date(source.circuitOpenUntil) > new Date())
  );
  return Response.json({
    configured: true,
    ingestionEnabled: process.env.PRODUCT_UPDATE_INGEST_ENABLED === "true",
    status: degraded.length > 0 ? "degraded" : "ok",
    sources
  });
}
