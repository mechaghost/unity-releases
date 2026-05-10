import { sha256 } from "./hash";

/**
 * Sitemap + per-resource HTML parsing for https://unity.com/resources.
 *
 * Unity's resources index is a client-rendered Next.js shell, so we can't
 * scrape it directly. Each individual `/resources/<slug>` page IS server-
 * rendered and inlines a Sanity-shaped JSON payload via `__next_f.push`
 * chunks - the structured fields (type, topics, vertical, date, isGated,
 * etc.) live there, escaped as `\"key\":\"value\"`.
 *
 * The full resources sitemap is at https://unity.com/resources/sitemap.xml
 * and uses standard `<loc>` + `<lastmod>` entries; we use lastmod as the
 * incremental-fetch boundary (skip pages whose lastmod hasn't advanced
 * past what we already have on file).
 */

export const SITEMAP_URL = "https://unity.com/resources/sitemap.xml";

export type SitemapEntry = {
  /** Absolute resource URL - `https://unity.com/resources/<slug>`. */
  url: string;
  /** Last-modified timestamp from the sitemap, ISO string. */
  lastmod: string | null;
};

/**
 * Pull every English `/resources/<slug>` URL out of the resources
 * sitemap. We deliberately skip locale-prefixed copies (`/fr/`, `/cn/`,
 * etc.) - they exist as `<xhtml:link>` alternates within each `<url>`
 * block and would only duplicate content if ingested.
 */
export function parseResourcesSitemap(xml: string): SitemapEntry[] {
  const out: SitemapEntry[] = [];
  // Each <url>…</url> block is a single resource. The English canonical
  // is the <loc>; alternates live in <xhtml:link rel="alternate">.
  const URL_BLOCK = /<url>([\s\S]*?)<\/url>/g;
  for (let m = URL_BLOCK.exec(xml); m !== null; m = URL_BLOCK.exec(xml)) {
    const block = m[1];
    const locMatch = /<loc>(https:\/\/unity\.com\/resources\/[^<\s]+)<\/loc>/.exec(block);
    if (!locMatch) continue;
    const url = locMatch[1];
    // Reject any URL that already has a locale segment baked in.
    if (/^https:\/\/unity\.com\/[a-z]{2}\/resources\//.test(url)) continue;
    const lastmodMatch = /<lastmod>([^<]+)<\/lastmod>/.exec(block);
    out.push({ url, lastmod: lastmodMatch ? lastmodMatch[1] : null });
  }
  return out;
}

export type ParsedResource = {
  slug: string;
  url: string;
  title: string;
  summary: string;
  ogImage: string | null;
  resourceType: string | null;
  industry: string | null;
  topics: string[];
  isGated: boolean;
  sfdcFormId: string | null;
  resourceDate: string | null;
  readDuration: string | null;
  author: string | null;
  bodyHash: string;
  rawMetadata: Record<string, unknown>;
};

/**
 * Parse one resource page's HTML. Returns null when the page renders the
 * site's soft-404 (the slug exists in the sitemap but Sanity has no
 * matching document, which happens for ~10% of sitemap entries).
 *
 * Strategy: extract the FIRST occurrence of each structured field from
 * the inlined RSC payload. Related-resource cards inside the same page
 * also embed `\"type\":...` etc., but the page's own resource block is
 * always written first.
 */
export function parseResourcePage(
  html: string,
  url: string,
  lastmod: string | null = null
): ParsedResource | null {
  const slug = extractSlug(url);
  if (!slug) return null;

  // The single most reliable signal that this page is a real resource
  // (and not a soft 404) is the presence of an isGated or resource-type
  // field. Pages that 404 render Next.js's default error component and
  // never produce these fields.
  const isGatedMatch = /\\"isGated\\":(true|false)/.exec(html);
  const resourceType = firstLabel(html, "type");

  if (!isGatedMatch && !resourceType) return null;

  const topics = collectFirstLabels(html, "topics");
  const industry = firstLabel(html, "vertical");
  const author = firstString(html, "author");
  const readDuration = firstLabel(html, "readDuration");
  const date = firstString(html, "date");
  // Title + description live inside the page-specific `\"seo\":{ ... }`
  // block. The first generic `\"title\"`/`\"description\"` matches in
  // the document belong to the site header nav and would label every
  // resource "Mango Header Navigation" if we pulled them naively. We
  // scan for the seo prefix, then read the next title/description fields
  // - Sanity always emits them in that order.
  const seoIndex = html.indexOf('\\"seo\\":{');
  let seoTitle: string | null = null;
  let seoDescription: string | null = null;
  if (seoIndex >= 0) {
    const window = html.slice(seoIndex, seoIndex + 4000);
    seoTitle = firstString(window, "title");
    seoDescription = firstString(window, "description");
  }
  const ogImage = firstImageUrl(html);
  const sfdcFormId = firstString(html, "sfcid");

  const bodyHash = sha256(html);

  return {
    slug,
    url,
    title: seoTitle ?? slug,
    summary: seoDescription ?? "",
    ogImage,
    resourceType: resourceType ?? null,
    industry: industry ?? null,
    topics,
    isGated: isGatedMatch ? isGatedMatch[1] === "true" : false,
    sfdcFormId: sfdcFormId ?? null,
    resourceDate: normalizeIsoDate(date),
    readDuration: readDuration ?? null,
    author: author ?? null,
    bodyHash,
    rawMetadata: {
      lastmod,
      seoTitle,
      seoDescription
    }
  };
}

function extractSlug(url: string): string | null {
  const m = /\/resources\/([^/?#]+)/.exec(url);
  return m ? m[1] : null;
}

/** First match for `\"<field>\":{\"label\":\"...\"}`. Used for type,
 *  vertical, readDuration - single-label container fields. */
function firstLabel(html: string, field: string): string | null {
  const re = new RegExp(`\\\\\"${escapeRegex(field)}\\\\\":\\{\\\\\"label\\\\\":\\\\\"([^"\\\\]+)\\\\\"\\}`);
  const m = re.exec(html);
  return m ? m[1] : null;
}

/** First `\"<field>\":[ {\"label\":\"a\"},{\"label\":\"b\"} ]` array.
 *  Used for topics + tags - short label lists. */
function collectFirstLabels(html: string, field: string): string[] {
  const re = new RegExp(`\\\\\"${escapeRegex(field)}\\\\\":\\[(.*?)\\]`);
  const m = re.exec(html);
  if (!m) return [];
  const labels: string[] = [];
  const inner = m[1];
  const LABEL = /\\"label\\":\\"([^"\\]+)\\"/g;
  for (let lm = LABEL.exec(inner); lm !== null; lm = LABEL.exec(inner)) {
    labels.push(lm[1]);
  }
  return labels;
}

/** First `\"<field>\":\"<value>\"` string field. */
function firstString(html: string, field: string): string | null {
  const re = new RegExp(`\\\\\"${escapeRegex(field)}\\\\\":\\\\\"([^"\\\\]+)\\\\\"`);
  const m = re.exec(html);
  return m ? m[1] : null;
}

/** First image URL from a Sanity CDN reference. We prefer the larger
 *  hero image (1200x630 share size when present) - pages often link a
 *  72×72 favicon first, so we scan all matches and pick the widest. */
function firstImageUrl(html: string): string | null {
  const RE = /https:\/\/cdn\.sanity\.io\/images\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+-(\d+)x(\d+)\.[A-Za-z0-9]+/g;
  let best: { url: string; area: number } | null = null;
  for (let m = RE.exec(html); m !== null; m = RE.exec(html)) {
    const area = Number(m[1]) * Number(m[2]);
    if (!best || area > best.area) best = { url: m[0], area };
  }
  return best?.url ?? null;
}

function normalizeIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  // Accept either `YYYY-MM-DD` or ISO timestamps; strip to a date.
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return m ? m[1] : null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
