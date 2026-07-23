import { getIssueStatuses, resolveDiffRange } from "@/lib/db/repositories";
import { compareToMarkdown } from "@/lib/compare-markdown";
import { LANES, EXPORT_ROW_LIMIT, safeSearchInRange } from "@/lib/compare-lanes";
import { parseCompareStreamSelection } from "@/lib/stream-filter";
import { isModernMajor } from "@/lib/unity-generation";
import type { IssueStatus } from "@/lib/issue-status";

export type CompareExportError =
  | "missing-versions"
  | "invalid-versions"
  | "range-not-found"
  | "empty-range";

// Editor-version shape we accept. Tight enough to reject random query
// strings, loose enough to allow every line we actually index. Patch-channel
// (`p`) is included because Unity shipped patch releases on the 2019/2020 LTS
// lines (e.g. `2020.3.48p1`).
const COMPARE_VERSION_SHAPE_RE = /^(\d+)\.\d+\.\d+[abfp]\d+$/;

// Legacy year majors are an closed, EOL set - only these are indexed
// (poll-legacy-lts walks exactly these sitemaps).
const LEGACY_COMPARE_MAJORS = new Set([2019, 2020, 2021, 2022]);

/**
 * Accept any modern-scheme major rather than a hardcoded list.
 *
 * `/llms.txt` documents `from`/`to` as "one of the indexed editor lines listed
 * above", and that list is generated from the database - so pinning this to
 * `6000` would have started returning 400 for exactly the diffs the manifest
 * advertises the day Unity 7 is ingested, including the 6000.7 -> 7000.0 jump.
 * Shape first, then major: unknown-but-modern majors are allowed through and
 * fail later as `range-not-found` if they genuinely aren't indexed, which is
 * the honest error.
 */
export function isComparableVersion(version: string): boolean {
  const match = version.match(COMPARE_VERSION_SHAPE_RE);
  if (!match) return false;
  const major = Number(match[1]);
  return isModernMajor(major) || LEGACY_COMPARE_MAJORS.has(major);
}

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

  if (!isComparableVersion(fromVersion) || !isComparableVersion(toVersion)) {
    return {
      ok: false,
      error: "invalid-versions",
      message:
        "`from` and `to` must be indexed Unity editor versions — for example 6000.0.50f1, 6000.1.0b4, 2022.3.40f1, or 2021.3.45f1."
    };
  }

  // Cross-major diffs (e.g. 2022.3.x → 6000.0.x) are allowed — the
  // 2022 LTS → Unity 6 jump is the upgrade decision most legacy-LTS
  // users actually care about. The output mixes release-note sets from
  // independent product lines, so callers should expect noisy lane
  // contents, but the data IS useful for upgrade planning.
  //
  // There is intentionally no upper bound on `range.versions.length`
  // here. `/compare.md` is the LLM-facing surface and "fully featured"
  // means a single fetch returns the full diff even for legacy-LTS →
  // Unity 6 jumps (~400 versions). The 8s `statement_timeout` on the
  // DB pool and the `EXPORT_ROW_LIMIT=5000` cap per lane act as the
  // floor-level safety net against pathological queries. The on-screen
  // /compare HTML page caps at 500 versions separately, because its
  // render path is ~5x more expensive per row than the markdown emit.

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
  // Scope to majors covered by the diff so a fix in an unreachable
  // major doesn't get tagged "fixed" — e.g. UUM-113215 is fixed in
  // 6000.3.0b1 but stays a known issue for the 2019/2020/2021/2022
  // LTS lines, so a 2019.4 → 2022.3 diff renders it as open, not
  // resolved.
  const issueIds = uniqueValues(
    exportLanes.flatMap((l) => l.rows.flatMap((r) => r.issue_ids ?? []))
  );
  const relevantMajors = new Set<number>(
    range.versions
      .map((v) => Number(v.slice(0, v.indexOf("."))))
      .filter((n) => Number.isFinite(n))
  );
  const issueStatuses = await safeIssueStatuses(issueIds, relevantMajors);

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

async function safeIssueStatuses(
  ids: string[],
  relevantMajors?: ReadonlySet<number>
): Promise<Map<string, IssueStatus>> {
  if (ids.length === 0) return new Map();
  try {
    return await getIssueStatuses(ids, { relevantMajors });
  } catch {
    return new Map();
  }
}

function uniqueValues<T>(values: T[]): T[] {
  return [...new Set(values)];
}
