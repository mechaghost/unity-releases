import { filtersFromSearchParams } from "@/lib/api";
import { listWatchFeedEvents } from "@/lib/db/repositories";
import { renderRssFeed } from "@/lib/rss";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filters = filtersFromSearchParams(url.searchParams);
  const events = await safeEvents(filters);
  const xml = renderRssFeed({
    title: "Unity Alerts",
    description: describeFeed(filters),
    siteUrl: `${url.origin}/`,
    feedUrl: url.toString(),
    events
  });

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}

async function safeEvents(filters: ReturnType<typeof filtersFromSearchParams>) {
  try {
    return await listWatchFeedEvents(filters, 50);
  } catch {
    return [];
  }
}

function describeFeed(filters: ReturnType<typeof filtersFromSearchParams>) {
  const parts = [
    filters.minorLine,
    filters.version,
    filters.platform,
    filters.packageName,
    filters.impactKind,
    filters.riskLevel,
    filters.q ? `"${filters.q}"` : ""
  ].filter(Boolean);

  return parts.length
    ? `Filtered Unity release-note activity for ${parts.join(", ")}`
    : "Unity release, package, and official news activity";
}
