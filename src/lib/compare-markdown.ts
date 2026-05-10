import { cleanReleaseNoteText } from "./release-notes/format";
import { dedupeByIssue } from "./diff-grouping";
import { issueStatusSuffix, type IssueStatus } from "./issue-status";

export type CompareMarkdownRow = {
  version: string;
  body: string;
  issue_ids: string[];
  package_names?: string[];
  release_date: string | Date | null;
};

export type CompareMarkdownLane = {
  id: string;
  title: string;
  mode: "by-release" | "by-issue" | "by-package";
  rows: CompareMarkdownRow[];
  totalCount: number;
};

export type CompareMarkdownInput = {
  fromVersion: string;
  toVersion: string;
  reversed?: boolean;
  lanes: CompareMarkdownLane[];
  issueStatuses?: Map<string, IssueStatus>;
  /**
   * Cap entries per lane so the output stays pasteable. Pass `null` (or
   * a non-positive number) to emit every row - used by the full-export
   * download where the consumer wants a complete dataset for an LLM.
   * Defaults to 50 (good for in-page previews / quick paste).
   */
  rowsPerLane?: number | null;
};

const ISSUE_TRACKER = "https://issuetracker.unity3d.com/issues";

export function compareToMarkdown(input: CompareMarkdownInput): string {
  const rawCap = input.rowsPerLane;
  const unlimited = rawCap === null || (typeof rawCap === "number" && rawCap <= 0);
  const cap = unlimited ? Number.POSITIVE_INFINITY : rawCap ?? 50;
  const arrow = input.reversed ? "←" : "→";
  const lines: string[] = [];

  lines.push(`# Unity ${input.fromVersion} ${arrow} ${input.toVersion}`);
  lines.push("");

  const lanesWithRows = input.lanes.filter((l) => l.totalCount > 0);
  if (lanesWithRows.length === 0) {
    lines.push("_No notable changes in this range._");
    return lines.join("\n");
  }

  for (const lane of lanesWithRows) {
    lines.push(`## ${lane.title} (${lane.totalCount.toLocaleString()})`);
    lines.push("");
    const rendered = appendLaneBullets(lines, lane, cap, input.issueStatuses);
    if (rendered < lane.rows.length) {
      lines.push(
        `_…${(lane.rows.length - rendered).toLocaleString()} more not shown._`
      );
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

/**
 * Returns a number that callers compare against `lane.rows.length` to
 * decide whether to print "N more not shown" - when this equals
 * `lane.rows.length`, no truncation message is emitted.
 */
function appendLaneBullets(
  lines: string[],
  lane: CompareMarkdownLane,
  cap: number,
  statuses: Map<string, IssueStatus> | undefined
): number {
  if (lane.mode === "by-issue") {
    const deduped = dedupeByIssue(lane.rows.map(toDedupeRow));
    const slice = deduped.slice(0, cap);
    for (const item of slice) {
      lines.push(formatIssueBullet(item, statuses));
    }
    // No cap hit → every source row is represented by some unique issue.
    if (slice.length === deduped.length) return lane.rows.length;
    // Otherwise account for source rows behind the rendered uniques only.
    return slice.reduce((acc, item) => acc + item.mentionCount, 0);
  }
  if (lane.mode === "by-package") {
    const seen = new Set<string>();
    let cappedOut = false;
    let consumedRows = 0;
    for (const row of lane.rows) {
      let usedThisRow = false;
      for (const pkg of row.package_names ?? []) {
        if (seen.has(pkg)) continue;
        if (seen.size >= cap) {
          cappedOut = true;
          break;
        }
        seen.add(pkg);
        lines.push(`- \`${pkg}\` updated in ${row.version}`);
        usedThisRow = true;
      }
      if (usedThisRow) consumedRows += 1;
      if (cappedOut) break;
    }
    if (seen.size === 0) {
      lines.push(`- ${lane.totalCount.toLocaleString()} package update(s) in this range.`);
      return lane.rows.length;
    }
    // No cap hit → every row was inspected, even if it added no new pkg.
    return cappedOut ? consumedRows : lane.rows.length;
  }
  const slice = lane.rows.slice(0, cap);
  for (const row of slice) {
    lines.push(formatReleaseBullet(row, statuses));
  }
  return slice.length;
}

function toDedupeRow(row: CompareMarkdownRow) {
  return {
    version: row.version,
    body: row.body,
    issue_ids: row.issue_ids,
    release_date: row.release_date
  };
}

function formatIssueBullet(
  item: ReturnType<typeof dedupeByIssue<ReturnType<typeof toDedupeRow>>>[number],
  statuses: Map<string, IssueStatus> | undefined
): string {
  const text = cleanReleaseNoteText(item.primary.body ?? "");
  const issueId = item.primary.issue_ids?.[0];
  const trail =
    item.firstVersion === item.lastVersion
      ? `seen in ${item.firstVersion}`
      : `seen ${item.firstVersion} → ${item.lastVersion} (${item.mentionCount} mentions)`;
  return `- ${text}${issueSuffix(issueId, statuses)} · ${trail}`;
}

function formatReleaseBullet(
  row: CompareMarkdownRow,
  statuses: Map<string, IssueStatus> | undefined
): string {
  const text = cleanReleaseNoteText(row.body ?? "");
  const id = (row.issue_ids ?? [])[0];
  return `- **${row.version}** ${text}${issueSuffix(id, statuses)}`;
}

function issueSuffix(
  id: string | undefined,
  statuses: Map<string, IssueStatus> | undefined
): string {
  if (!id) return "";
  const link = `[${id}](${ISSUE_TRACKER}/${id.toLowerCase()})`;
  const status = statuses?.get(id);
  const suffix = status ? issueStatusSuffix(status) : null;
  return suffix ? ` - ${link} (${suffix})` : ` - ${link}`;
}
