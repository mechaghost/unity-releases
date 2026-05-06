type IssuePillProps = {
  id: string;
  url?: string | null;
};

const ISSUE_TRACKER_BASE = "https://issuetracker.unity3d.com/issues";

export function issueTrackerHref(id: string): string {
  return `${ISSUE_TRACKER_BASE}/${id.toLowerCase()}`;
}

export function IssuePill({ id, url }: IssuePillProps) {
  const href = url ?? issueTrackerHref(id);
  return (
    <a
      className="chip chip--issue"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${id} on Unity Issue Tracker`}
    >
      {id}
    </a>
  );
}
