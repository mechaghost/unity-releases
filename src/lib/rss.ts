import type { FeedEventRow } from "./db/repositories";

type RenderRssFeedInput = {
  title: string;
  description: string;
  siteUrl: string;
  feedUrl: string;
  events: Array<
    Pick<
      FeedEventRow,
      "stable_guid" | "title" | "summary" | "source_url" | "event_time" | "event_type" | "risk_level" | "tags"
    >
  >;
};

export function renderRssFeed(input: RenderRssFeedInput): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(input.title)}</title>
    <description>${escapeXml(input.description)}</description>
    <link>${escapeXml(input.siteUrl)}</link>
    <atom:link href="${escapeXml(input.feedUrl)}" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${input.events.map(renderItem).join("\n")}
  </channel>
</rss>`;
}

function renderItem(event: RenderRssFeedInput["events"][number]): string {
  const categories = [...event.tags, event.event_type, event.risk_level]
    .filter((value): value is string => Boolean(value))
    .map((tag) => `      <category>${escapeXml(tag)}</category>`)
    .join("\n");

  return `    <item>
      <title>${escapeXml(event.title)}</title>
      <description>${escapeXml(event.summary)}</description>
      <link>${escapeXml(event.source_url)}</link>
      <guid isPermaLink="false">${escapeXml(event.stable_guid)}</guid>
      <pubDate>${new Date(event.event_time).toUTCString()}</pubDate>
${categories}
    </item>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
