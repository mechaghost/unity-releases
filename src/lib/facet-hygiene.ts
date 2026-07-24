/**
 * Facet hygiene for free-text area/platform values mined from release
 * notes. The parser stores whatever Unity wrote in the note prefix, which
 * leaks non-taxonomy tokens into the facet dropdowns: package ids, version
 * lists, tracker ids, markdown artifacts, and one-word verbs. Filtering
 * happens at the facet layer, NOT at ingest - the rows themselves stay
 * stored and searchable; only the dropdown options are curated.
 *
 * Deliberately case-insensitive-dedupe only: values that differ by more
 * than case ("HD RP" vs "HDRP") stay separate entries, because the search
 * predicates match stored values exactly - folding spellings here would
 * make the minority spelling's rows unreachable. Callers should pass
 * values most-frequent-first so the kept variant of a case-dupe is the
 * one matching the most rows.
 */

/** True for values that are parser leakage, not areas/platforms. */
export function isJunkFacetValue(value: string): boolean {
  const v = value.trim();
  if (v.length < 2) return true;
  // Package ids leak into both area and platform columns; the Package
  // facet is its own dropdown, so they're pure noise here.
  if (/^com\.unity\./i.test(v)) return true;
  // Bare version strings ("6000.0.55f1") and comma-joined version lists
  // ("6000.0.55f1,6000.3.0a4") that the parser mistook for an area.
  if (/^\d+\.\d+(\.\d+)?([abfp]\d+)?(\s*,|$)/.test(v)) return true;
  // Tracker/CI ids: UUM-/UIT-/UTR-style tokens are issue references.
  if (/^(UUM|UIT|UTR|DSTR|BUR|ECSB)[-`]/i.test(v)) return true;
  // Markdown/code artifacts: backticks, escapes, key=value fragments.
  if (v.includes("`") || v.includes("\\") || v.includes("=")) return true;
  // "N/A (internal)" and friends - a parser placeholder, not an area.
  if (/^N\/?A\b/i.test(v)) return true;
  // One-word note verbs/fragments that are prose leakage, not areas.
  const JUNK_WORDS = new Set([
    "done",
    "error",
    "library",
    "visibility",
    "fixed",
    "changed",
    "added",
    "removed",
    "improved",
    "updated",
    "deprecated",
    "after",
    "before"
  ]);
  if (JUNK_WORDS.has(v.toLowerCase())) return true;
  return false;
}

/**
 * Drop junk values and case-insensitive duplicates, preserving input
 * order (pass most-frequent-first so the kept case-variant is the one
 * that matches the most rows), then A-Z sort for dropdown display.
 */
export function cleanFacetValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of values) {
    if (typeof raw !== "string") continue;
    const v = raw.trim();
    if (isJunkFacetValue(v)) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(v);
  }
  return kept.sort((a, b) => a.localeCompare(b));
}
