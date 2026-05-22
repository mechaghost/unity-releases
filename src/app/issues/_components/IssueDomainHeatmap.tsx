import { ALL_DOMAINS_PLUS_OTHER, type IssueHeatmapCell } from "@/lib/issues";

/**
 * Domain × status (open / fixed) heatmap. Answers "where do the still-
 * open issues cluster?" without forcing the user to filter the table.
 *
 * Single-color intensity scale (sequential, not diverging) because the
 * data is a count, not a balance. Open and Fixed share the same scale
 * so the columns are comparable.
 */
export function IssueDomainHeatmap({ cells }: { cells: IssueHeatmapCell[] }) {
  if (cells.length === 0) {
    return (
      <div className="viz-card">
        <h2>Issues by domain × status</h2>
        <p className="muted">No domain-classified issues yet.</p>
      </div>
    );
  }

  // Lookup map keyed by `${domain}::${status}` → count.
  const cellLookup = new Map<string, number>();
  let maxCount = 1;
  for (const c of cells) {
    cellLookup.set(`${c.domain}::${c.status}`, c.count);
    if (c.count > maxCount) maxCount = c.count;
  }

  const rows = ALL_DOMAINS_PLUS_OTHER;
  const columns: Array<{ status: "open" | "fixed"; label: string }> = [
    { status: "open", label: "Open" },
    { status: "fixed", label: "Fixed" }
  ];

  const cellW = 90;
  const cellH = 28;
  const labelW = 140;
  const headerH = 32;
  const padding = 8;
  const width = padding + labelW + columns.length * cellW + padding;
  const height = headerH + rows.length * cellH + padding;

  return (
    <div className="viz-card">
      <div className="viz-card__header">
        <h2>Issues by domain × status</h2>
        <div className="viz-card__legend">
          <span className="muted">low</span>
          <span className="viz-legend-swatch viz-legend-swatch--heat-1" />
          <span className="viz-legend-swatch viz-legend-swatch--heat-2" />
          <span className="viz-legend-swatch viz-legend-swatch--heat-3" />
          <span className="viz-legend-swatch viz-legend-swatch--heat-4" />
          <span className="muted">high</span>
        </div>
      </div>
      <p className="viz-card__sub">
        Each cell = number of UUM ids in that subsystem with that
        status. Open includes Regressed (Unity-shipped fix, then
        re-listed). Click any cell to drill into the filtered list.
      </p>
      <div className="viz-scroll">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          preserveAspectRatio="xMinYMid meet"
          role="img"
          aria-label={`Issues by domain and status heatmap: ${rows.length} subsystem rows by ${columns.length} status columns`}
          style={{ maxHeight: height + 16, display: "block" }}
        >
          <title>Issues by domain × status</title>
          {/* column headers */}
          {columns.map((col, ci) => {
            const x = padding + labelW + ci * cellW + cellW / 2;
            return (
              <text
                key={col.status}
                x={x}
                y={headerH - 10}
                textAnchor="middle"
                className="viz-heatmap-version-label"
              >
                {col.label}
              </text>
            );
          })}
          {/* rows */}
          {rows.map((domain, ri) => {
            const y = headerH + ri * cellH;
            return (
              <g key={domain}>
                <text
                  x={padding + labelW - 8}
                  y={y + cellH / 2}
                  dominantBaseline="middle"
                  textAnchor="end"
                  className="viz-heatmap-row-label"
                >
                  {domain}
                </text>
                {columns.map((col, ci) => {
                  const x = padding + labelW + ci * cellW;
                  const count = cellLookup.get(`${domain}::${col.status}`) ?? 0;
                  const heatClass = heatClassFor(count, maxCount);
                  const cellInner = (
                    <>
                      <title>{`${domain} · ${col.label} · ${count}${count > 0 ? " — click to filter" : ""}`}</title>
                      <rect
                        x={x + 1}
                        y={y + 1}
                        width={cellW - 2}
                        height={cellH - 2}
                        rx={2}
                        ry={2}
                        className={`viz-heat-cell ${heatClass}`}
                      />
                      {count > 0 ? (
                        <text
                          x={x + cellW / 2}
                          y={y + cellH / 2}
                          dominantBaseline="middle"
                          textAnchor="middle"
                          className="viz-heat-cell__text"
                        >
                          {count}
                        </text>
                      ) : null}
                    </>
                  );
                  if (count === 0) {
                    return <g key={col.status}>{cellInner}</g>;
                  }
                  const href = `/issues?area=${encodeURIComponent(domain)}&status=${col.status}`;
                  return (
                    <a
                      key={col.status}
                      href={href}
                      className="viz-heat-cell__link"
                      aria-label={`${count} ${col.label.toLowerCase()} issues in ${domain} — open filtered list`}
                    >
                      <g>{cellInner}</g>
                    </a>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function heatClassFor(count: number, max: number): string {
  if (count === 0) return "viz-heat-cell--zero";
  const ratio = count / Math.max(1, max);
  if (ratio > 0.66) return "viz-heat-cell--heat-4";
  if (ratio > 0.33) return "viz-heat-cell--heat-3";
  if (ratio > 0.1) return "viz-heat-cell--heat-2";
  return "viz-heat-cell--heat-1";
}
