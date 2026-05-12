import { getIssueStatuses, resolveDiffRange } from "@/lib/db/repositories";
import { compareToMarkdown } from "@/lib/compare-markdown";
import { LANES, EXPORT_ROW_LIMIT, safeSearchInRange } from "@/lib/compare-lanes";
import { parseCompareStreamSelection } from "@/lib/stream-filter";
import type { IssueStatus } from "@/lib/issue-status";

export type CompareExportError =
  | "missing-versions"
  | "invalid-versions"
  | "cross-major"
  | "range-not-found"
  | "empty-range"
  | "range-too-wide";

// Editor-version shape we accept. Tight enough to reject random query
// strings, loose enough to allow indexed legacy LTS lines (2019.4,
// 2020.3, 2021.3, 2022.3) alongside Unity 6 (6000.X.Y).
const COMPARE_VERSION_RE = /^(2019|2020|2021|2022|6000)\.\d+\.\d+[abf]\d+$/;
const MAX_COMPARE_EXPORT_VERSIONS = 200;

export type CompareExportResult =
  | {
      ok: true;
      fromVersion: string;
      toVersion: string;
      reversed: boolean;
      versions: string[];
      markdown: string;
    }
  | {
      ok: false;
      error: CompareExportError;
      message: string;
    };

/**
 * Stateless markdown export of the same lane data the `/compare` page
 * renders, intended for non-browser consumers (LLMs, scripts, CI).
 *
 * Honoured query params:
 * - `from` / `to` (required) - Unity editor versions to diff
 * - `stream` (optional, repeatable) - restrict the in-between releases
 *   to specific streams (`LTS`, `Update/Supported`, `beta`, `alpha`).
 *   When omitted, behaves like the UI default (LTS-only).
 *
 * Cookies, persona presets, manifest filters, and other URL filters
 * are deliberately ignored - the same URL must always produce the same
 * markdown so callers can cache, paste, and share it.
 */
export async function buildCompareMarkdownExport(
  params: URLSearchParams
): Promise<CompareExportResult> {
  const fromVersion = (params.get("from") ?? "").trim();
  const toVersion = (params.get("to") ?? "").trim();

  if (!fromVersion || !toVersion) {
    return {
      ok: false,
      error: "missing-versions",
      message:
        "Both `from` and `to` query parameters are required. Example: /compare.md?from=6000.0.50f1&to=6000.0.74f1"
    };
  }

  if (!COMPARE_VERSION_RE.test(fromVersion) || !COMPARE_VERSION_RE.test(toVersion)) {
    return {
      ok: false,
      error: "invalid-versions",
      message:
        "`from` and `to` must be indexed Unity editor versions — for example 6000.0.50f1, 6000.1.0b4, 2022.3.40f1, or 2021.3.45f1."
    };
  }

  // Cross-major comparisons (e.g. 2022.3.x → 6000.0.x) mix release-note
  // sets from independent product lines and produce noisy, misleading
  // diffs. Reject them at the validator so callers get a clear error
  // instead of a 200-row dump of unrelated changelogs.
  const fromMajor = fromVersion.slice(0, fromVersion.indexOf("."));
  const toMajor = toVersion.slice(0, toVersion.indexOf("."));
  if (fromMajor !== toMajor) {
    return {
      ok: false,
      error: "cross-major",
      message:
        `Compare is scoped to a single Unity major line at a time (got ${fromMajor}.x → ${toMajor}.x). Pick two versions from the same major (e.g. both 2022.3.x or both 6000.x.y).`
    };
  }

  const selectedStreams = parseCompareStreamSelection(params.getAll("stream"));
  const range = await resolveDiffRange(fromVersion, toVersion, selectedStreams);
  if (!range) {
    return {
      ok: false,
      error: "range-not-found",
      message: `One of "${fromVersion}" or "${toVersion}" isn't in the index. See /releases for the canonical version list.`
    };
  }
  if (range.versions.length === 0) {
    return {
      ok: false,
      error: "empty-range",
      message: `No releases between "${fromVersion}" and "${toVersion}" in this stream scope.`
    };
  }
  if (range.versions.length > MAX_COMPARE_EXPORT_VERSIONS) {
    return {
      ok: false,
      error: "range-too-wide",
      message: `This compare range includes ${range.versions.length} releases. Please request ${MAX_COMPARE_EXPORT_VERSIONS} or fewer releases.`
    };
  }

  // Fetch every lane in scope without any UI-side pagination so the
  // markdown is the full dataset for an LLM, not just the current page.
  const exportLaneRowsRaw = await Promise.all(
    LANES.map((lane) =>
      safeSearchInRange(range.versions, lane, {}, EXPORT_ROW_LIMIT)
    )
  );

  const exportLanes = LANES.map((def, i) => {
    let rows = exportLaneRowsRaw[i] ?? [];
    if (def.postFilter) rows = rows.filter(def.postFilter);
    return { def, rows };
  }).filter((l) => l.rows.length > 0);

  // Resolve issue statuses (open / closed / fixed) for every issue id
  // mentioned, so the markdown can suffix `[fixed in 6000.x.y]` etc.
  const issueIds = uniqueValues(
    exportLanes.flatMap((l) => l.rows.flatMap((r) => r.issue_ids ?? []))
  );
  const issueStatuses = await safeIssueStatuses(issueIds);

  const markdown = compareToMarkdown({
    fromVersion,
    toVersion,
    reversed: range.reversed,
    issueStatuses,
    rowsPerLane: null,
    lanes: exportLanes.map((l) => ({
      id: l.def.id,
      title: l.def.title,
      mode: l.def.mode,
      rows: l.rows,
      totalCount: l.rows.length
    }))
  });

  return {
    ok: true,
    fromVersion,
    toVersion,
    reversed: range.reversed,
    versions: range.versions,
    markdown
  };
}

async function safeIssueStatuses(ids: string[]): Promise<Map<string, IssueStatus>> {
  if (ids.length === 0) return new Map();
  try {
    return await getIssueStatuses(ids);
  } catch {
    return new Map();
  }
}

function uniqueValues<T>(values: T[]): T[] {
  return [...new Set(values)];
}
