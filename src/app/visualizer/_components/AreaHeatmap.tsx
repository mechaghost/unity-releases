import { DOMAINS, type AreaHeatmapCell, type VersionAggregate } from "@/lib/visualizer";

/**
 * Versions × domain grid. Cell intensity = breaking + api-change count.
 * Lets the user spot which subsystem absorbed the most upgrade-pain in
 * each release. Rows are the curated DOMAINS in fixed order so the
 * pattern stays stable as new versions ship.
 */
export function AreaHeatmap({
  cells,
  versions
}: {
  cells: AreaHeatmapCell[];
  versions: VersionAggregate[];
}) {
  // Most-recent 24 versions, chronologically.
  const visibleVersions = versions
    .filter((v) => v.releaseDate)
    .slice(0, 24)
    .sort((a, b) => (a.releaseDate ?? "").localeCompare(b.releaseDate ?? ""));

  if (visibleVersions.length === 0) {
    return (
      <div className="viz-card">
        <h2>Breaking-change heatmap by domain</h2>
        <p className="muted">No data.</p>
      </div>
    );
  }

  const rows: Array<string> = [...DOMAINS, "Other"];
  const cellLookup = new Map<string, number>();
  let maxCount = 1;
  for (const c of cells) {
    cellLookup.set(`${c.domain}::${c.version}`, c.total);
    if (c.total > maxCount) maxCount = c.total;
  }

  const cellW = 22;
  const cellH = 18;
  const labelW = 110;
  // Tall enough for a ~70px version label rotated 55° (vertical extent
  // = 70 * sin(55°) ≈ 57px). Anchor sits at headerH - 4; text extends
  // *upward* from the anchor with positive rotation (CW in SVG).
  const headerH = 80;
  const padding = 16;
  const width = padding + labelW + visibleVersions.length * cellW + padding;
  const height = headerH + rows.length * cellH + 24;

  return (
    <div className="viz-card">
      <div className="viz-card__header">
        <h2>Breaking-change heatmap by domain</h2>
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
        Rows = subsystem, columns = recent versions. Cell shade = count of{" "}
        <code>breaking_change + api_change</code> notes. Click a cell to open
        the release.
      </p>
      <div className="viz-scroll">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          preserveAspectRatio="xMinYMid meet"
          style={{ maxHeight: height + 16, display: "block" }}
          role="img"
          aria-label={`Breaking-change heatmap: ${rows.length} subsystem rows by ${visibleVersions.length} recent versions`}
        >
          <title>Breaking-change heatmap by domain</title>
          {/* version column headers (rotated) */}
          {visibleVersions.map((v, i) => {
            const x = padding + labelW + i * cellW + cellW / 2;
            return (
              <text
                key={v.version}
                x={x}
                y={headerH - 4}
                transform={`rotate(55, ${x}, ${headerH - 4})`}
                className="viz-heatmap-version-label"
                textAnchor="end"
              >
                {v.version}
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
                {visibleVersions.map((v, ci) => {
                  const x = padding + labelW + ci * cellW;
                  const count = cellLookup.get(`${domain}::${v.version}`) ?? 0;
                  const heatClass = heatClassFor(count, maxCount);
                  // Drill-through: jump to the release detail page with the
                  // lanes filter pre-set to breaking + api — exactly the
                  // notes the cell is counting. Avoids the 4-click path
                  // (heatmap → release → filter drawer → set lane).
                  return (
                    <a
                      key={v.version}
                      href={`/releases/${encodeURIComponent(v.version)}?lanes=breaking,api`}
                    >
                      <title>{`${domain} · ${v.version} · ${count} breaking/API`}</title>
                      <rect
                        x={x + 1}
                        y={y + 1}
                        width={cellW - 2}
                        height={cellH - 2}
                        rx={1.5}
                        ry={1.5}
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
  if (ratio > 0.10) return "viz-heat-cell--heat-2";
  return "viz-heat-cell--heat-1";
}
