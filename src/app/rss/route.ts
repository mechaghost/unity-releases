import { listFeedEvents } from "@/lib/db/repositories";
import { renderRssFeed } from "@/lib/rss";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const events = await safeEvents();
  const xml = renderRssFeed({
    title: "Unity Alerts",
    description: "Filtered Unity release and package activity",
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

async function safeEvents() {
  try {
    return await listFeedEvents(50);
  } catch {
    return [];
  }
}
