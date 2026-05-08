import {
  issueStatusLabel,
  issueStatusSuffix,
  issueStatusTone,
  type IssueStatus
} from "@/lib/issue-status";

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
  const suffix = status ? issueStatusSuffix(status) : null;
  const titleSuffix =
    status && status.kind !== "unknown" ? ` — ${issueStatusLabel(status)}` : "";
  return (
    <a
      className="chip chip--issue"
      data-status={tone ?? undefined}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${id} on Unity Issue Tracker${titleSuffix}`}
    >
      <span className="chip--issue__id">{id}</span>
      {suffix ? <span className="chip--issue__suffix">{suffix}</span> : null}
    </a>
  );
}
