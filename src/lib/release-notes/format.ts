export type IssueLink = {
  id: string;
  url: string;
};

const TRAILING_ISSUE_IDS_RE = /\s*\(\s*UUM-\d+(?:\s*,\s*UUM-\d+)*\s*\)\s*$/i;

/**
 * Resolve a numeric HTML entity to its character. Refuses C0/C1 control
 * points and out-of-range values - a malformed entity should render as
 * the original text, not as an invisible control character in a note
 * body that later feeds search indexing and markdown export.
 */
function decodeCodePoint(code: number, original: string): string {
  if (!Number.isFinite(code) || code < 0x20 || code > 0x10ffff) return original;
  if (code >= 0x7f && code <= 0x9f) return original;
  try {
    return String.fromCodePoint(code);
  } catch {
    return original;
  }
}

/**
 * Matches Unity editor version strings inline in body text - the same
 * format `parseUnityVersion` accepts (`<major>.<minor>.<patch>[abfp]<num>`).
 * Negative lookarounds keep us from grabbing substrings of longer
 * digit runs (e.g. `60000.3.15f10` shouldn't surface a phantom
 * `0000.3.15f1` match).
 */
const UNITY_VERSION_INLINE_RE = /(?<!\d)(\d+\.\d+\.\d+[abfp]\d+)(?!\d)/g;

export function cleanReleaseNoteText(body: string): string {
  return (
    body
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
      // Emphasis strip skips backslash-escaped asterisks: `\*ptr\*` is a
      // literal asterisk pair, restored by the unescape pass below - the
      // naive form ate the `*`s here before unescaping could see them.
      .replace(/(?<!\\)\*([^*]+)(?<!\\)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      // HTML entities survive scraping (sometimes double-encoded:
      // `-&amp;gt;`). `&amp;` first so a double-encoded entity collapses in
      // one pass; React re-escapes on render, so decoding is safe.
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&(?:#39|apos);/g, "'")
      .replace(/&nbsp;/g, " ")
      // Numeric entities. Unity writes the version separator in every
      // "Package updates" row as `&#x2192;` (→), so without this the
      // release-detail lane rendered a literal "10.1.0 &#x2192; 10.1.1".
      // Runs after the `&amp;` collapse above so double-encoded forms
      // (`&amp;#x2192;`) decode in the same pass.
      .replace(/&#x([0-9a-fA-F]{1,6});/gi, (whole, hex: string) =>
        decodeCodePoint(parseInt(hex, 16), whole)
      )
      .replace(/&#(\d{1,7});/g, (whole, dec: string) =>
        decodeCodePoint(parseInt(dec, 10), whole)
      )
      // Unescape the full markdown-escapable set (`\[WebGPU\]`, `\!=`,
      // `demangling\_unexpected\_handler`, …) - AFTER the markdown strips
      // above, so `\*literal\*` isn't first unescaped into emphasis and
      // then stripped.
      .replace(/\\([\\`*_{}[\]()#+\-.!|<>~])/g, "$1")
      .replace(/^:\s*/, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(TRAILING_ISSUE_IDS_RE, "")
      .trim()
  );
}

export type ReleaseNoteToken =
  | { kind: "text"; value: string }
  | { kind: "version"; version: string };

/**
 * Detects the special case where Unity overloads the `area` column with
 * a comma-separated list of cross-version backport targets, e.g.
 *   area = "6000.6.0a2,6000.4.4f1,6000.5.0b5"
 * Returns the parsed version array if every comma-separated piece is a
 * Unity version, otherwise `null` so the caller falls back to the
 * normal subsystem chip rendering. Whitespace around commas is allowed
 * because Unity isn't consistent about it.
 */
export function parseAreaVersionList(area: string | null | undefined): string[] | null {
  if (!area) return null;
  const trimmed = area.trim();
  if (trimmed.length === 0) return null;
  const parts = trimmed.split(/\s*,\s*/);
  if (parts.length < 2) return null;
  const versionPattern = /^\d+\.\d+\.\d+[abfp]\d+$/;
  for (const part of parts) {
    if (!versionPattern.test(part)) return null;
  }
  return parts;
}

/**
 * Slice a cleaned release-note body into a list of tokens so the
 * renderer can swap inline Unity-version mentions for a `<VersionPill>`
 * link without resorting to `dangerouslySetInnerHTML`. The output
 * always concatenates back to the input string, so callers can still
 * use the original cleaned body for `title` attributes, copy-to-LLM
 * exports, and search.
 */
export function tokenizeReleaseNoteBody(cleanedBody: string): ReleaseNoteToken[] {
  if (!cleanedBody) return [];
  const tokens: ReleaseNoteToken[] = [];
  let lastIndex = 0;
  // Reset because /g regexes carry lastIndex state between calls when
  // reused, and we're constructing a new one each call already - but
  // exec-style iteration via matchAll is safe and gives us indexes.
  for (const match of cleanedBody.matchAll(UNITY_VERSION_INLINE_RE)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      tokens.push({ kind: "text", value: cleanedBody.slice(lastIndex, matchIndex) });
    }
    tokens.push({ kind: "version", version: match[1] });
    lastIndex = matchIndex + match[0].length;
  }
  if (lastIndex < cleanedBody.length) {
    tokens.push({ kind: "text", value: cleanedBody.slice(lastIndex) });
  }
  return tokens;
}

export function normalizeIssueLinks(issueIds: string[] = [], rawLinks: unknown): IssueLink[] {
  const parsedLinks = Array.isArray(rawLinks) ? rawLinks : [];
  const byId = new Map<string, IssueLink>();

  for (const link of parsedLinks) {
    if (!isIssueLink(link)) continue;
    byId.set(link.id, { id: link.id, url: link.url });
  }

  for (const id of issueIds) {
    if (!byId.has(id)) {
      byId.set(id, { id, url: issueTrackerSearchUrl(id) });
    }
  }

  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function issueTrackerSearchUrl(issueId: string): string {
  return `https://issuetracker.unity3d.com/issues?search=${encodeURIComponent(issueId)}`;
}

function isIssueLink(value: unknown): value is IssueLink {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "url" in value &&
    typeof value.id === "string" &&
    typeof value.url === "string"
  );
}
