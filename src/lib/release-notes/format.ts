export type IssueLink = {
  id: string;
  url: string;
};

const TRAILING_ISSUE_IDS_RE = /\s*\(\s*UUM-\d+(?:\s*,\s*UUM-\d+)*\s*\)\s*$/i;

export function cleanReleaseNoteText(body: string): string {
  return body
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\\([()])/g, "$1")
    .replace(/^:\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(TRAILING_ISSUE_IDS_RE, "")
    .trim();
}

export function normalizeIssueLinks(issueIds: string[] = [], rawLinks: unknown): IssueLink[] {
  const parsedLinks = Array.isArray(rawLinks) ? rawLinks : [];
  const byId = new Map<string, IssueLink>();

  for (const link of parsedLinks) {
    if (!isIssueLink(link)) continue;
    byId.set(link.id, { id: link.id, url: link.url });
  }

  for (const id of issueIds) {
    if (!byId.has(id)) {
      byId.set(id, { id, url: issueTrackerSearchUrl(id) });
    }
  }

  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function issueTrackerSearchUrl(issueId: string): string {
  return `https://issuetracker.unity3d.com/issues?search=${encodeURIComponent(issueId)}`;
}

function isIssueLink(value: unknown): value is IssueLink {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "url" in value &&
    typeof value.id === "string" &&
    typeof value.url === "string"
  );
}
