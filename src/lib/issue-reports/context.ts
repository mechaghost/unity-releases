export type IssueReportContext = {
  issueId: string;
  title: string;
  url: string;
  fetchedAt: string;
  excerpt: string;
  descriptionTruncated?: boolean;
};

export function reportExcerpt(description: string, query?: string): string {
  const terms = (query?.match(/[\p{L}\p{N}_]+/gu) ?? []).filter(term => term.length > 2);
  const lower = description.toLowerCase();
  const positions = terms.map(term => lower.indexOf(term.toLowerCase())).filter(at => at >= 0);
  const start = positions.length ? Math.max(0, Math.min(...positions) - 80) : 0;
  const chunk = description.slice(start, start + 396);
  return `${start ? "…" : ""}${chunk}${start + chunk.length < description.length ? "…" : ""}`;
}

const escapeMarkdown = (text: string) => text.replace(/([\\`*_{}\[\]()<>#!|])/g, "\\$1").replace(/[\r\n]+/g, " ");
export function issueReportsMarkdown(reports: IssueReportContext[] = []): string {
  return reports.map(report => `\n  - Linked bug report [${escapeMarkdown(report.issueId)}: ${escapeMarkdown(report.title)}](${report.url.replace(/[()]/g, c => c === "(" ? "%28" : "%29")}) (retrieved ${report.fetchedAt.slice(0, 10)})${report.excerpt ? ` — ${escapeMarkdown(report.excerpt)}` : ""}`).join("");
}


export function groupIssueReports<T extends { issueReports?: IssueReportContext[] }>(rows: T[], keys: (row: T) => string[]): Map<string, IssueReportContext[]> {
  const groups = new Map<string, Map<string, IssueReportContext>>();
  for (const row of rows) for (const key of keys(row)) {
    const group = groups.get(key) ?? new Map<string, IssueReportContext>();
    for (const report of row.issueReports ?? []) group.set(report.issueId, report);
    groups.set(key, group);
  }
  return new Map([...groups].map(([key, reports]) => [key, [...reports.values()].sort((a,b) => a.issueId.localeCompare(b.issueId))]));
}
