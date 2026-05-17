import type { IssueRow } from "@/lib/issues";
import { IssuePill } from "@/app/_components/IssuePill";
import { VersionPill } from "@/app/_components/VersionPill";
import { HoverInfo } from "@/app/_components/HoverInfo";
import { formatReleaseDate, formatRelativeDate } from "@/lib/format-date";
import { cleanReleaseNoteText } from "@/lib/release-notes/format";
import { stripAreaPrefix } from "@/lib/classification";

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
          <th>Description</th>
          <th>Introduced</th>
          <th>Fixed</th>
          <th className="issue-table__num">Days open</th>
          <th className="issue-table__num">Mentions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const cleaned = describeIssue(row.description, row.area);
          return (
          <tr key={row.issueId}>
            <td>
              <IssuePill id={row.issueId} />
            </td>
            <td>
              <span className={`chip chip--status-${toneFor(row.status)}`}>
                {labelFor(row.status)}
              </span>
            </td>
            <td className="issue-table__desc">
              {cleaned ? (
                <HoverInfo
                  title={
                    <span className="issue-card__title-row">
                      <code className="issue-card__id">{row.issueId}</code>
                      <span className={`chip chip--status-${toneFor(row.status)}`}>
                        {labelFor(row.status)}
                      </span>
                    </span>
                  }
                  body={<IssueCardBody row={row} />}
                  footer={
                    <a href={`/issues/${encodeURIComponent(row.issueId)}`}>
                      Open issue detail · every mention →
                    </a>
                  }
                >
                  <span className="issue-table__desc-text">
                    {row.area ? (
                      <span className="issue-table__desc-area">{row.area}: </span>
                    ) : null}
                    {cleaned}
                  </span>
                </HoverInfo>
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
      return "warn";
  }
}

/** Rich-hover body — the "whole issue card." Shows everything the
 *  table row carries, including the FULL untruncated description.
 *  Renders inside the HoverInfo's body slot so the popover's title
 *  (issue id + status) sits above this. */
function IssueCardBody({ row }: { row: IssueRow }) {
  const fullDescription = row.description
    ? cleanReleaseNoteText(row.area ? stripAreaPrefix(row.description) : row.description)
    : null;
  return (
    <div className="issue-card__body">
      {fullDescription ? (
        <p className="issue-card__description">{fullDescription}</p>
      ) : null}
      <dl className="issue-card__meta">
        {row.area ? (
          <>
            <dt>Area</dt>
            <dd>
              <code>{row.area}</code>
            </dd>
          </>
        ) : null}
        {row.introducedVersion ? (
          <>
            <dt>Introduced</dt>
            <dd>
              <code>{row.introducedVersion}</code>
              {row.introducedDate ? (
                <span className="muted">
                  {" "}· {formatReleaseDate(row.introducedDate)}{" "}
                  ({formatRelativeDate(row.introducedDate)})
                </span>
              ) : null}
            </dd>
          </>
        ) : null}
        {row.fixedVersion ? (
          <>
            <dt>Fixed</dt>
            <dd>
              <code>{row.fixedVersion}</code>
              {row.fixedDate ? (
                <span className="muted">
                  {" "}· {formatReleaseDate(row.fixedDate)}
                </span>
              ) : null}
            </dd>
          </>
        ) : null}
        {row.daysOpen != null ? (
          <>
            <dt>{row.fixedVersion ? "Resolution time" : "Days open"}</dt>
            <dd>
              {Math.floor(row.daysOpen)} day{Math.floor(row.daysOpen) === 1 ? "" : "s"}
            </dd>
          </>
        ) : null}
        <dt>Mentions</dt>
        <dd>
          {row.mentionCount} release{row.mentionCount === 1 ? "" : "s"}
        </dd>
      </dl>
    </div>
  );
}
