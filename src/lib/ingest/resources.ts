import { sha256 } from "./hash";
import {
  extractFlightStream,
  findFlightObject,
  parseFlightRows
} from "./rsc-flight";

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

/** Shape of the Sanity resource document inside the Flight payload. */
function isResourceDocument(node: Record<string, unknown>): boolean {
  if (!node.seo || typeof node.seo !== "object") return false;
  // Mirrors the legacy soft-404 guard: a real resource always carries at
  // least one of these; the site's error page renders a bare seo block.
  return "isGated" in node || "type" in node || "date" in node;
}

function labelOf(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const label = (value as Record<string, unknown>).label;
  return typeof label === "string" && label.length > 0 ? label : null;
}

function stringOf(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Safe nested lookup: `pathOf(doc, "seo", "teaserImage", "file")`. */
function pathOf(root: unknown, ...keys: string[]): unknown {
  let node: unknown = root;
  for (const key of keys) {
    if (!node || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

/**
 * Preferred path: read the resource straight out of the parsed Flight
 * payload. Because the payload is reconstructed and handed to
 * JSON.parse, escaping is handled by the JSON decoder - the whole class
 * of "regex ate the value" bugs (entity-truncated titles, quotes cutting
 * a title short, `$3a` reference tokens) cannot occur here. Reference
 * strings are resolved, so a deduplicated description comes back as its
 * real prose rather than a placeholder.
 */
function parseViaFlight(html: string, url: string, lastmod: string | null): ParsedResource | null {
  const rows = parseFlightRows(extractFlightStream(html));
  if (rows.size === 0) return null;
  const doc = findFlightObject(rows, isResourceDocument);
  if (!doc) return null;

  const slug = extractSlug(url);
  if (!slug) return null;
  const seo = (doc.seo ?? {}) as Record<string, unknown>;
  const rawTopics = Array.isArray(doc.topics) ? doc.topics : [];
  const teaserUrl = stringOf(
    pathOf(doc, "seo", "teaserImage", "file", "asset", "url")
  );

  const title = stringOf(seo.title);
  const summary = stringOf(seo.description);
  return {
    slug,
    url,
    title: normalizeWhitespace(title) ?? slug,
    summary: normalizeWhitespace(summary) ?? "",
    ogImage: teaserUrl ?? firstImageUrl(html),
    resourceType: labelOf(doc.type),
    industry: labelOf(doc.vertical),
    topics: rawTopics.map(labelOf).filter((t): t is string => Boolean(t)),
    isGated: doc.isGated === true,
    sfdcFormId: stringOf(doc.sfcid),
    resourceDate: normalizeIsoDate(stringOf(doc.date)),
    readDuration: labelOf(doc.readDuration),
    author: stringOf(doc.author),
    bodyHash: sha256(html),
    rawMetadata: {
      lastmod,
      parserPath: "flight",
      seoTitle: title,
      seoDescription: summary
    }
  };
}

/** Collapse encoded/real whitespace so a card never renders a literal
 *  `\n` (Unity's CMS leaves them in many seo descriptions). */
function normalizeWhitespace(value: string | null): string | null {
  if (value === null) return null;
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed.length > 0 ? collapsed : null;
}

/**
 * Parse one resource page's HTML. Returns null when the page renders the
 * site's soft-404 (the slug exists in the sitemap but Sanity has no
 * matching document, which happens for ~10% of sitemap entries).
 *
 * Two paths. The Flight reader is authoritative; the legacy
 * string-scanner below is a safety net for the day Next.js changes how
 * it inlines the payload. Which path produced a row is recorded in
 * `rawMetadata.parserPath` so `npm run check:invariants` can alarm on
 * legacy-path usage instead of it degrading silently - the exact
 * failure mode that let "Text 1" sit in production for months.
 */
export function parseResourcePage(
  html: string,
  url: string,
  lastmod: string | null = null
): ParsedResource | null {
  const viaFlight = parseViaFlight(html, url, lastmod);
  if (viaFlight) return viaFlight;

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
      parserPath: "legacy-scanner",
      seoTitle,
      seoDescription
    }
  };
}

function extractSlug(url: string): string | null {
  const m = /\/resources\/([^/?#]+)/.exec(url);
  return m ? m[1] : null;
}

/**
 * The payload is JSON inside a JS string literal, so it carries TWO
 * layers of escaping. In raw page bytes:
 *
 *   value delimiter        `\"`      (1 backslash + quote)
 *   quote inside a value   `\\\"`    (3 backslashes + quote)
 *   backslash in a value   `\\\\`
 *   `&` and friends        `&`  (JS-layer unicode escape)
 *   JSON newline           `\\n`
 *
 * A regex cannot reliably tell the 1-backslash terminator from the
 * 3-backslash escaped quote (both are an odd run), which is how
 * "Madbox achieves \"mad growth\"…" got truncated to `Madbox achieves \`.
 * Count the backslash run instead: a quote closes the value only when
 * its run length is ≡ 1 (mod 4) — run 1 is the bare delimiter, run 3 is
 * an escaped quote, run 5 is an escaped backslash then the delimiter.
 *
 * Returns the RAW (still-escaped) body plus the index just past the
 * closing delimiter, or null when the string never terminates.
 */
function readEscapedString(
  source: string,
  start: number
): { raw: string; end: number } | null {
  let i = start;
  while (i < source.length) {
    const ch = source[i];
    if (ch !== "\\") {
      // A bare quote can't appear inside a value (every quote is
      // escaped at the JS layer); treat one as a malformed payload.
      if (ch === '"') return null;
      i += 1;
      continue;
    }
    let j = i;
    while (j < source.length && source[j] === "\\") j += 1;
    const run = j - i;
    if (source[j] === '"') {
      if (run % 4 === 1) return { raw: source.slice(start, i), end: j + 1 };
      i = j + 1; // escaped quote - part of the value
      continue;
    }
    i = j; // &, \\n, … - skip the run, keep scanning
  }
  return null;
}

/**
 * Decode a raw body down to display text by peeling the two escaping
 * layers with JSON.parse (the raw body is a valid JS string literal
 * body, and what that yields is a valid JSON string body). Whitespace
 * is collapsed because some Unity descriptions carry encoded newlines
 * that would otherwise render as a literal `\n` on the card.
 * Each pass is independently guarded so a malformed fragment degrades
 * instead of throwing.
 */
function decodeValue(raw: string): string {
  let out = raw;
  for (let pass = 0; pass < 2; pass += 1) {
    try {
      out = JSON.parse(`"${out}"`) as string;
    } catch {
      break;
    }
  }
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Next.js Flight deduplicates long strings: the field holds a reference
 * token (`$3a`) and the text is emitted in a later `__next_f.push`
 * chunk. Resolving one means reconstructing the whole stream across
 * push boundaries, so we simply refuse the token - an absent summary
 * beats rendering a literal `$3a` on the card, which is what
 * /resources/lessons-learned-in-building-a-digital-landfill-twin did.
 * Flight prefixes every special value with `$` (`$undefined`, `$L1`,
 * `$Sreact.suspense`); requiring the WHOLE value to be a short
 * space-free token keeps prose that merely starts with a dollar sign.
 */
const FLIGHT_REF_RE = /^\$[0-9a-zA-Z.$]{0,24}$/;

function isFlightReference(value: string): boolean {
  return FLIGHT_REF_RE.test(value);
}

/** Read `\"<field>\":\"<value>\"` starting the search at `from`. */
function readFieldAt(
  html: string,
  field: string,
  from: number
): { value: string; end: number } | null {
  const marker = `\\"${field}\\":\\"`;
  const at = html.indexOf(marker, from);
  if (at < 0) return null;
  const read = readEscapedString(html, at + marker.length);
  if (!read) return null;
  const value = decodeValue(read.raw);
  if (isFlightReference(value)) return null;
  return { value, end: read.end };
}

/** First match for `\"<field>\":{\"label\":\"...\"}`. Used for type,
 *  vertical, readDuration - single-label container fields. */
function firstLabel(html: string, field: string): string | null {
  const marker = `\\"${field}\\":{`;
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const read = readFieldAt(html, "label", at + marker.length);
  return read ? read.value : null;
}

/** First `\"<field>\":[ {\"label\":\"a\"},{\"label\":\"b\"} ]` array.
 *  Used for topics + tags - short label lists. */
function collectFirstLabels(html: string, field: string): string[] {
  const re = new RegExp(`\\\\\"${escapeRegex(field)}\\\\\":\\[(.*?)\\]`);
  const m = re.exec(html);
  if (!m) return [];
  const labels: string[] = [];
  const inner = m[1];
  let cursor = 0;
  for (;;) {
    const read = readFieldAt(inner, "label", cursor);
    if (!read) break;
    labels.push(read.value);
    cursor = read.end;
  }
  return labels;
}

/** First `\"<field>\":\"<value>\"` string field. */
function firstString(html: string, field: string): string | null {
  const read = readFieldAt(html, field, 0);
  return read ? read.value : null;
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
