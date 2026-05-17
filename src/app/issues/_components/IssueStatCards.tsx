import type { IssueStats } from "@/lib/issues";

/**
 * Four headline numbers across the top of /issues. Honest framing — no
 * computed scores or marketing math, just raw counts. Each card states
 * the formula in muted text so the user can audit what they're looking
 * at without leaving the page.
 */
export function IssueStatCards({ stats }: { stats: IssueStats }) {
  const cards: Array<{
    label: string;
    value: number;
    hint: string;
  }> = [
    {
      label: "Tracked issues",
      value: stats.total,
      hint: "Distinct UUM-ids mentioned in any indexed release note."
    },
    {
      label: "Currently open",
      value: stats.currentlyOpen,
      hint: "Issues whose latest Known-Issues mention is newer than any Fix mention."
    },
    {
      label: "Fixed in last 30 days",
      value: stats.fixedRecently,
      hint: "Earliest Fix mention sits in a release dated within the last 30 days."
    },
    {
      label: "Regressed",
      value: stats.regressed,
      hint: "Unity shipped a Fix, then re-listed the issue as Known later."
    }
  ];

  return (
    <div className="issue-stats" role="list">
      {cards.map((c) => (
        <div key={c.label} className="issue-stats__card" role="listitem">
          <div className="issue-stats__label">{c.label}</div>
          <div className="issue-stats__value tabnums">{c.value.toLocaleString()}</div>
          <div className="issue-stats__hint muted">{c.hint}</div>
        </div>
      ))}
    </div>
  );
}
