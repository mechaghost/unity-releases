import type { IssueStats } from "@/lib/issues";

/**
 * Four headline numbers across the top of /issues. Honest framing — no
 * computed scores or marketing math, just raw counts. Each card states
 * the formula in muted text so the user can audit what they're looking
 * at without leaving the page.
 *
 * The three filterable cards (Open / Fixed-30d / Regressed) double as
 * drill-through links into the search-mode view at /issues?status=…
 * The Tracked-issues card has no canonical filter (it's a denominator)
 * so it stays inert.
 */
export function IssueStatCards({ stats }: { stats: IssueStats }) {
  const cards: Array<{
    label: string;
    value: number;
    hint: string;
    href: string | null;
  }> = [
    {
      label: "Tracked issues",
      value: stats.total,
      hint: "Distinct UUM-ids mentioned in any indexed release note.",
      href: null
    },
    {
      label: "Currently open",
      value: stats.currentlyOpen,
      hint: "Issues whose latest Known-Issues mention is newer than any Fix mention.",
      href: "/issues?status=open"
    },
    {
      label: "Fixed in last 30 days",
      value: stats.fixedRecently,
      hint: "Earliest Fix mention sits in a release dated within the last 30 days.",
      // Drill-through carries only the 30-day window — no status=fixed
      // overlay. The card counts every issue whose first-fix is in the
      // window, including ones that later regressed, so adding
      // status=fixed would silently exclude those and the count on the
      // card would no longer match the rows on the destination page.
      href: "/issues?fixed_within=30&sort=date-desc"
    },
    {
      label: "Regressed",
      value: stats.regressed,
      hint: "Unity shipped a Fix, then re-listed the issue as Known later.",
      href: "/issues?status=regressed"
    }
  ];

  return (
    <div className="issue-stats" role="list">
      {cards.map((c) => {
        const inner = (
          <>
            <div className="issue-stats__label">{c.label}</div>
            <div className="issue-stats__value tabnums">{c.value.toLocaleString()}</div>
            <div className="issue-stats__hint muted">{c.hint}</div>
          </>
        );
        if (c.href) {
          return (
            <a
              key={c.label}
              className="issue-stats__card issue-stats__card--link"
              role="listitem"
              href={c.href}
              aria-label={`${c.label}: ${c.value.toLocaleString()}. Click to filter.`}
            >
              {inner}
            </a>
          );
        }
        return (
          <div key={c.label} className="issue-stats__card" role="listitem">
            {inner}
          </div>
        );
      })}
    </div>
  );
}
