import { expect, test } from "vitest";
import { compareToMarkdown } from "../../src/lib/compare-markdown";
import { groupIssueReports, reportExcerpt, type IssueReportContext } from "../../src/lib/issue-reports/context";
import { issueGroupKey } from "../../src/lib/diff-grouping";
const report: IssueReportContext = { issueId: "UUM-123", title: "A [report] <script>alert(1)</script>", url: "https://issuetracker.unity.com/issues/123/example", excerpt: "File descriptors", fetchedAt: "2026-11-02T00:00:00Z" };
const rows = [
  { version: "6000.3.23f1", body: "Fixed a crash.", issue_ids: [], release_date: "2026-08-26", package_names: ["com.fixture"] },
  { version: "6000.3.22f1", body: "Fixed a crash.", issue_ids: ["UUM-123"], release_date: "2026-08-25", issueReports: [report], package_names: ["com.fixture"] }
];
test("context uses exactly the same grouping keys as issue deduplication", () => {
  const groups = groupIssueReports(rows, row => [issueGroupKey(row)]);
  expect(groups.get(issueGroupKey(rows[0]))).toEqual([]);
  expect(groups.get(issueGroupKey(rows[1]))).toEqual([report]);
  const markdown = compareToMarkdown({ fromVersion: "6000.3.21f1", toVersion: "6000.3.23f1", lanes: [{ id: "fix", title: "Fixes", mode: "by-issue", rows, totalCount: 2 }] });
  const bullets = markdown.split("\n- ");
  expect(bullets[1]).not.toContain("Linked bug report");
  expect(bullets[2]).toContain("Linked bug report");
  expect(markdown).toContain("\\<script\\>");
});
test.each(["by-release", "by-package"] as const)("exports source context for %s lanes", mode => {
  const markdown = compareToMarkdown({ fromVersion: "6000.3.21f1", toVersion: "6000.3.23f1", lanes: [{ id: "test", title: "Test", mode, rows, totalCount: 2 }] });
  expect(markdown).toContain("Linked bug report");
  expect(markdown).toContain("retrieved 2026-11-02");
});
test("excerpts stay bounded and include relevant terms late in a description", () => {
  const result = reportExcerpt("padding ".repeat(100) + "Linux file descriptors" + " more".repeat(100), "descriptors");
  expect(result.length).toBeLessThanOrEqual(400);
  expect(result).toContain("descriptors");
});
