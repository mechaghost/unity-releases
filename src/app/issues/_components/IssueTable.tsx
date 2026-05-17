import type { IssueRow } from "@/lib/issues";
import { IssuePill } from "@/app/_components/IssuePill";
import { VersionPill } from "@/app/_components/VersionPill";
import { formatReleaseDate } from "@/lib/format-date";

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
  emptyMessage = "No issues to show."
}: {
  rows: IssueRow[];
  emptyMessage?: string;
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
          <th>Area</th>
          <th>Introduced</th>
          <th>Fixed</th>
          <th className="issue-table__num">Days open</th>
          <th className="issue-table__num">Mentions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.issueId}>
            <td>
              <IssuePill id={row.issueId} />
            </td>
            <td>
              <span className={`chip chip--status-${toneFor(row.status)}`}>
                {labelFor(row.status)}
              </span>
            </td>
            <td className="muted">{row.area ?? "—"}</td>
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
        ))}
      </tbody>
    </table>
  );
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
      return "warn";
  }
}
