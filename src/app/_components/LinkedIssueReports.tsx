import type { IssueReportContext } from "@/lib/issue-reports/context";

export function LinkedIssueReports({ reports = [] }: { reports?: IssueReportContext[] }) {
  if (!reports.length) return null;
  const render = (report: IssueReportContext) => (
    <div className="linked-issue-report" key={report.issueId}>
      <a href={report.url} rel="noopener noreferrer" className="link-external">
        {report.issueId}: {report.title}
      </a>
      {report.excerpt ? <p>{report.excerpt}</p> : null}
      <span className="muted">Retrieved {report.fetchedAt.slice(0, 10)}{report.descriptionTruncated ? " · Description shortened; open the report for full text" : ""}</span>
    </div>
  );
  return <div className="linked-issue-reports">
    <span className="muted">Linked bug {reports.length === 1 ? "report" : "reports"}</span>
    {reports.slice(0, 2).map(render)}
    {reports.length > 2 ? <details><summary>{reports.length - 2} more linked reports</summary>{reports.slice(2).map(render)}</details> : null}
  </div>;
}
