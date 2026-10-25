import { XMLParser } from "fast-xml-parser";

export type ParsedBlogPost = {
  guid: string;
  title: string;
  description: string;
  link: string;
  publishedAt: string;
  categories: string[];
  feedUrl: string;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true
});

export function parseUnityBlogRss(xml: string, feedUrl: string): ParsedBlogPost[] {
  const parsed = parser.parse(xml) as {
    rss?: { channel?: { item?: unknown } };
  };
  if (!parsed.rss?.channel) throw new Error("Expected an RSS channel");
  const items = asArray(parsed.rss.channel.item);
  if (items.length === 0) throw new Error("RSS feed contained no posts");

  return items.map((item) => {
    if (!item || typeof item !== "object") throw new Error("RSS post must be an object");
    const record = item as Record<string, unknown>;
    const link = stringValue(record.link).trim();
    const guid = stringValue(record.guid).trim() || link;
    const title = stringValue(record.title).trim();
    const pubDate = stringValue(record.pubDate).trim();
    let validLink = false;
    try { validLink = ["http:", "https:"].includes(new URL(link).protocol); } catch { /* Invalid source URL. */ }
    if (!guid || !title || !validLink) throw new Error("RSS post requires a title, identifier, and HTTP(S) link");
    if (pubDate && !Number.isFinite(Date.parse(pubDate))) throw new Error("RSS post has an invalid publication date");

    return {
      guid,
      title,
      description: stringValue(record.description),
      link,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date(0).toISOString(),
      categories: asArray(record.category).map((category) => stringValue(category)).filter(Boolean),
      feedUrl
    };
  });
}

function asArray(value: unknown): unknown[] {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function stringValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (value && typeof value === "object" && "#text" in value) {
    return stringValue((value as Record<string, unknown>)["#text"]);
  }
  return "";
}
