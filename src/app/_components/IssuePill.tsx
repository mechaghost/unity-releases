import {
  issueStatusLabel,
  issueStatusTone,
  type IssueStatus
} from "@/lib/issue-status";
import { HoverInfo } from "./HoverInfo";

type IssuePillProps = {
  id: string;
  url?: string | null;
  status?: IssueStatus | null;
};

const ISSUE_TRACKER_BASE = "https://issuetracker.unity3d.com/issues";

export function issueTrackerHref(id: string): string {
  return `${ISSUE_TRACKER_BASE}/${id.toLowerCase()}`;
}

export function IssuePill({ id, url, status }: IssuePillProps) {
  const href = url ?? issueTrackerHref(id);
  const tone = status && status.kind !== "unknown" ? issueStatusTone(status) : null;
  const chip = (
    <a
      className="chip chip--issue"
      data-status={tone ?? undefined}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="chip--issue__id">{id}</span>
    </a>
  );

  return (
    <HoverInfo
      // asChild: the chip itself is already a focusable <a>. Avoids
      // doubling the tab stops on lane-heavy pages (~50 issue pills
      // per release-detail view).
      asChild
      title={id}
      body={
        <>
          <p>
            <strong>{statusHeadline(status)}</strong>
          </p>
          {statusBody(status)}
        </>
      }
      footer={
        <>
          <a href={`/issues/${encodeURIComponent(id)}`}>All mentions of {id}</a>
          {" · "}
          <a href={href} target="_blank" rel="noopener noreferrer">
            Unity Issue Tracker ↗
          </a>
        </>
      }
    >
      {chip}
    </HoverInfo>
  );
}

function statusHeadline(status: IssueStatus | null | undefined): string {
  if (!status) return "Listed in a release note";
  return issueStatusLabel(status);
}

function statusBody(status: IssueStatus | null | undefined) {
  if (!status || status.kind === "unknown") {
    return (
      <p className="muted">
        Mentioned in at least one release note but no resolution status
        could be derived.
      </p>
    );
  }
  if (status.kind === "resolved") {
    return (
      <p className="muted">
        First closed in <code>{status.version}</code>
        {status.additionalFixCount > 0
          ? ` (plus ${status.additionalFixCount} subsequent fix mention${status.additionalFixCount === 1 ? "" : "s"})`
          : ""}
        . Considered fixed unless re-listed as a known issue in a later
        version.
      </p>
    );
  }
  if (status.kind === "regressed") {
    return (
      <p className="muted">
        Was fixed in <code>{status.lastFixedVersion}</code> but re-listed
        as a known issue in <code>{status.knownVersion}</code> — assume
        the regression is live.
      </p>
    );
  }
  if (status.kind === "open") {
    return (
      <p className="muted">
        Listed as a known issue in <code>{status.version}</code> with no
        fix mention in any later release we&apos;ve indexed.
      </p>
    );
  }
  return (
    <p className="muted">
      Mentioned in <code>{status.version}</code>.
    </p>
  );
}
