import { listIngestionFreshness } from "@/lib/db/repositories";

export const dynamic = "force-dynamic";

export async function GET() {
  let freshness: Awaited<ReturnType<typeof listIngestionFreshness>> = [];
  let dbError: string | null = null;
  try {
    freshness = await listIngestionFreshness();
  } catch (err) {
    dbError = err instanceof Error ? err.message : "Unknown error";
  }

  const stale = freshness.filter((f) => f.isStale);
  const overall = dbError
    ? "error"
    : stale.length > 0
      ? "stale"
      : freshness.length === 0
        ? "empty"
        : "ok";

  return Response.json({
    status: overall,
    checkedAt: new Date().toISOString(),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    dbError,
    ingestion: freshness.map((f) => ({
      sourceType: f.sourceType,
      lastSuccessAt: f.lastSuccessAt,
      lastRunAt: f.lastRunAt,
      hoursSinceLastSuccess:
        Number.isFinite(f.hoursSinceLastSuccess)
          ? Math.round(f.hoursSinceLastSuccess * 10) / 10
          : null,
      isStale: f.isStale
    }))
  });
}
