import { scaleTime } from "@visx/scale";
import type { IssueLifespan } from "@/lib/visualizer";

/**
 * Per-issue horizontal lifespan bars. x = release_date. Each row is one
 * issue; bar starts at its first known-issue mention and ends at its
 * first fix mention (or "today" if still open). Sorted by days-open desc
 * so the longest-living bugs surface first.
 */
export function IssueLifespanLines({ issues }: { issues: IssueLifespan[] }) {
  const filtered = issues.filter((i) => i.introducedDate).slice(0, 30);
  if (filtered.length === 0) {
    return (
      <div className="viz-card">
        <h2>Issue lifespan — introduced → fixed</h2>
        <p className="muted">No lifespan data yet.</p>
      </div>
    );
  }

  const dates: Date[] = [];
  for (const i of filtered) {
    if (i.introducedDate) dates.push(new Date(i.introducedDate));
    if (i.fixedDate) dates.push(new Date(i.fixedDate));
  }
  dates.push(new Date());

  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

  const rowH = 18;
  const width = 880;
  const height = 60 + filtered.length * rowH + 24;
  const margin = { top: 24, right: 16, bottom: 24, left: 160 };
  const innerW = width - margin.left - margin.right;

  const xScale = scaleTime({
    domain: [minDate, maxDate],
    range: [0, innerW]
  });

  return (
    <div className="viz-card">
      <div className="viz-card__header">
        <h2>Issue lifespan — introduced → fixed</h2>
        <div className="viz-card__legend">
          <span className="viz-legend-swatch viz-legend-swatch--green" /> fixed
          <span className="viz-legend-swatch viz-legend-swatch--red" /> still open
          <span className="viz-legend-swatch viz-legend-swatch--blocker" /> blocker risk
        </div>
      </div>
      <p className="viz-card__sub">
        Bar start = first <code>Known Issues</code> mention. Bar end = first{" "}
        <code>Fixes</code> mention (or today, if unfixed). Click an issue id
        to drill in.
      </p>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" preserveAspectRatio="xMinYMid meet">
          {/* axis ticks */}
          {xScale.ticks(6).map((tick) => {
            const x = margin.left + xScale(tick);
            return (
              <g key={tick.toISOString()}>
                <line
                  x1={x}
                  x2={x}
                  y1={margin.top - 4}
                  y2={height - margin.bottom}
                  className="viz-gridline"
                />
                <text x={x} y={14} textAnchor="middle" className="viz-axis-label">
                  {tick.toISOString().slice(0, 7)}
                </text>
              </g>
            );
          })}
          {filtered.map((issue, i) => {
            const y = margin.top + i * rowH;
            const x1 = margin.left + xScale(new Date(issue.introducedDate ?? ""));
            const x2 = margin.left + xScale(new Date(issue.fixedDate ?? new Date().toISOString()));
            const isOpen = !issue.fixedDate;
            const classes = [
              "viz-lifespan-bar",
              isOpen ? "viz-lifespan-bar--open" : "viz-lifespan-bar--fixed",
              issue.hadBlocker ? "viz-lifespan-bar--blocker" : ""
            ]
              .filter(Boolean)
              .join(" ");
            const days = issue.daysOpen != null ? Math.floor(issue.daysOpen) : null;
            return (
              <g key={issue.issueId}>
                <a href={`/issues/${encodeURIComponent(issue.issueId)}`}>
                  <text
                    x={margin.left - 8}
                    y={y + rowH / 2}
                    dominantBaseline="middle"
                    textAnchor="end"
                    className="viz-lifespan-label"
                  >
                    {issue.issueId}
                  </text>
                  <title>{`${issue.issueId}${issue.area ? ` · ${issue.area}` : ""} · ${days != null ? `${days}d ` : ""}${issue.introducedVersion ?? "?"} → ${issue.fixedVersion ?? "open"}`}</title>
                  <rect
                    x={x1}
                    y={y + 3}
                    width={Math.max(2, x2 - x1)}
                    height={rowH - 6}
                    rx={2}
                    ry={2}
                    className={classes}
                  />
                </a>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
