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
  const items = asArray(parsed.rss?.channel?.item);

  return items.map((item) => {
    const record = item as Record<string, unknown>;
    const link = stringValue(record.link);
    const guid = stringValue(record.guid) || link;
    const pubDate = stringValue(record.pubDate);

    return {
      guid,
      title: stringValue(record.title),
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
