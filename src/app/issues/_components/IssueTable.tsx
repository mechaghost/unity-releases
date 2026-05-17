import type {
  IssueRow,
  IssueSearchArea,
  IssueSearchSort,
  IssueSearchStatus
} from "@/lib/issues";
import { IssuePill } from "@/app/_components/IssuePill";
import { VersionPill } from "@/app/_components/VersionPill";
import { formatReleaseDate } from "@/lib/format-date";
import { cleanReleaseNoteText } from "@/lib/release-notes/format";
import { stripAreaPrefix } from "@/lib/classification";

export type SortableContext = {
  query: string;
  status: IssueSearchStatus;
  area: IssueSearchArea;
  current: IssueSearchSort;
};

/**
 * Shared table for any sorted-by-something issue list on /issues. The
 * parent picks the data and the heading; this component just renders.
 *
 * Status pill is computed in SQL by the data layer rather than by
 * deriveIssueStatus in JS, because the latter wants per-mention rows
 * (we don't fetch those for table contexts).
 */
export function IssueTable({
  rows,
  emptyMessage = "No issues to show.",
  sortable
}: {
  rows: IssueRow[];
  emptyMessage?: string;
  /** When provided, the Days-open and Mentions headers become
   *  toggleable sort links pointing back at /issues with updated
   *  sort + page=1 query params. */
  sortable?: SortableContext;
}) {
  if (rows.length === 0) {
    return <p className="muted">{emptyMessage}</p>;
  }
  return (
    <table className="issue-table dense-table tabnums">
      <thead>
        <tr>
          <th>Issue</th>
          <th>Status</th>
          <th>Description</th>
          <th>Introduced</th>
          <th>Fixed</th>
          <th
            className="issue-table__num"
            aria-sort={ariaSortFor(sortable, "days-asc", "days-desc")}
          >
            {sortable ? (
              <SortHeader
                label="Days open"
                ascKey="days-asc"
                descKey="days-desc"
                context={sortable}
              />
            ) : (
              "Days open"
            )}
          </th>
          <th
            className="issue-table__num"
            aria-sort={ariaSortFor(sortable, "mentions-asc", "mentions-desc")}
          >
            {sortable ? (
              <SortHeader
                label="Mentions"
                ascKey="mentions-asc"
                descKey="mentions-desc"
                context={sortable}
              />
            ) : (
              "Mentions"
            )}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const cleaned = describeIssue(row.description, row.area);
          return (
          <tr key={row.issueId}>
            <td>
              <IssuePill id={row.issueId} compact />
            </td>
            <td>
              <span className={`chip chip--status-${toneFor(row.status)}`}>
                {labelFor(row.status)}
              </span>
            </td>
            <td className="issue-table__desc">
              {cleaned ? (
                <span className="issue-table__desc-text" title={cleaned}>
                  {row.area ? (
                    <span className="issue-table__desc-area">{row.area}: </span>
                  ) : null}
                  {cleaned}
                </span>
              ) : (
                <span className="muted">—</span>
              )}
            </td>
            <td>
              {row.introducedVersion ? (
                <span className="issue-table__col-stack">
                  <VersionPill version={row.introducedVersion} />
                  {row.introducedDate ? (
                    <span className="muted issue-table__date">
                      {formatReleaseDate(row.introducedDate)}
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="muted">—</span>
              )}
            </td>
            <td>
              {row.fixedVersion ? (
                <span className="issue-table__col-stack">
                  <VersionPill version={row.fixedVersion} />
                  {row.fixedDate ? (
                    <span className="muted issue-table__date">
                      {formatReleaseDate(row.fixedDate)}
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="muted">—</span>
              )}
            </td>
            <td className="issue-table__num">
              {row.daysOpen != null ? Math.floor(row.daysOpen) : "—"}
            </td>
            <td className="issue-table__num">{row.mentionCount}</td>
          </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Trim the issue body for inline table display:
 *  - drop the leading "Area:" prefix (we render that as a separate
 *    tag) so the description doesn't lead with redundant text
 *  - run cleanReleaseNoteText to collapse Unity's markdown / links
 *  - cap at ~240 chars with an ellipsis so the cell stays clamped to
 *    two lines visually
 *  Full text remains accessible via the cell's `title` attribute and
 *  via the per-issue detail page. */
function describeIssue(body: string | null, area: string | null): string {
  if (!body) return "";
  let text = body;
  if (area) text = stripAreaPrefix(text);
  text = cleanReleaseNoteText(text);
  return text.length > 240 ? text.slice(0, 237).trimEnd() + "…" : text;
}

function labelFor(status: IssueRow["status"]): string {
  switch (status) {
    case "open":
      return "Open";
    case "fixed":
      return "Fixed";
    case "regressed":
      return "Regressed";
  }
}

function toneFor(status: IssueRow["status"]): string {
  switch (status) {
    case "open":
      return "warn";
    case "fixed":
      return "good";
    case "regressed":
      return "bad";
  }
}

/** Clickable column header. Cycles through:
 *    inactive → desc → asc → desc → …
 *  The base label always renders, with a small ▼ / ▲ / ↕ glyph
 *  reflecting the current state. */
function SortHeader({
  label,
  ascKey,
  descKey,
  context
}: {
  label: string;
  ascKey: IssueSearchSort;
  descKey: IssueSearchSort;
  context: SortableContext;
}) {
  const isAsc = context.current === ascKey;
  const isDesc = context.current === descKey;
  // Clicking when desc → asc. Otherwise jump to desc (most useful
  // direction first for both days-open and mentions).
  const nextKey: IssueSearchSort = isDesc ? ascKey : descKey;
  const nextDirection = isDesc ? "ascending" : "descending";
  const href = sortHref(context.query, context.status, context.area, nextKey);
  const arrow = isDesc ? "▼" : isAsc ? "▲" : "↕";
  const active = isAsc || isDesc;
  return (
    <a
      className={`issue-table__sort ${active ? "issue-table__sort--active" : ""}`}
      href={href}
      aria-label={`Sort by ${label}, ${nextDirection}`}
    >
      {label}{" "}
      <span className="issue-table__sort-arrow" aria-hidden>
        {arrow}
      </span>
    </a>
  );
}

function sortHref(
  query: string,
  status: IssueSearchStatus,
  area: IssueSearchArea,
  sort: IssueSearchSort
): string {
  const params = new URLSearchParams();
  if (query.length > 0) params.set("q", query);
  if (status !== "all") params.set("status", status);
  if (area !== "all") params.set("area", area);
  if (sort !== "date-desc") params.set("sort", sort);
  // Reset to page 1 — current page may not exist under the new sort.
  const qs = params.toString();
  return qs.length > 0 ? `/issues?${qs}` : "/issues";
}

/** WAI-ARIA aria-sort value for a sortable <th>. Returns "ascending" /
 *  "descending" when the column is the active sort, "none" when it's
 *  sortable but inactive, and undefined when the table isn't sortable
 *  (so the attribute is omitted entirely). */
function ariaSortFor(
  sortable: SortableContext | undefined,
  ascKey: IssueSearchSort,
  descKey: IssueSearchSort
): "ascending" | "descending" | "none" | undefined {
  if (!sortable) return undefined;
  if (sortable.current === ascKey) return "ascending";
  if (sortable.current === descKey) return "descending";
  return "none";
}
