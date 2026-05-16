import type { VersionAggregate } from "@/lib/visualizer";
import { HoverInfo } from "@/app/_components/HoverInfo";
import { streamLabel } from "@/lib/stream-labels";
import { formatReleaseDate, formatRelativeDate } from "@/lib/format-date";

/**
 * Horizontal cell strip — one cell per release. Color encodes the net-fix
 * score (fixes − knownIssues). Green for net-positive, red for net-negative,
 * neutral for unparsed / empty releases.
 *
 * The strip renders in chronological order (oldest → newest, left → right)
 * so the user reads it like a stock chart. Mobile-blocker indicator
 * (small phone dot) shows on cells with ≥1 mobile known-issue.
 */
export function StabilityHeatStrip({
  versions
}: {
  versions: VersionAggregate[];
}) {
  if (versions.length === 0) {
    return (
      <div className="viz-card">
        <h2>Stability heat strip</h2>
        <p className="muted">No releases to chart yet.</p>
      </div>
    );
  }

  // Chronological order, oldest first.
  const sorted = [...versions]
    .filter((v) => v.releaseDate)
    .sort((a, b) => (a.releaseDate ?? "").localeCompare(b.releaseDate ?? ""));

  const cellGap = 2;
  const cellW = 14;
  const cellH = 56;
  const padding = 24;
  const width = padding * 2 + sorted.length * (cellW + cellGap);
  const height = cellH + 40;

  const maxAbsNet = Math.max(
    1,
    ...sorted.map((v) => Math.abs(v.netFix))
  );

  return (
    <div className="viz-card">
      <div className="viz-card__header">
        <h2>Stability heat strip</h2>
        <div className="viz-card__legend">
          <span className="viz-legend-swatch viz-legend-swatch--green" /> net fixes
          <span className="viz-legend-swatch viz-legend-swatch--neutral" /> mixed
          <span className="viz-legend-swatch viz-legend-swatch--red" /> net regressions
          <span className="viz-legend-dot" /> mobile blocker
        </div>
      </div>
      <p className="viz-card__sub">
        Each cell = one release. Color encodes <code>fixes − known-issues</code>.
        Hover a cell for the version + counts. Click to open the release.
      </p>
      <div className="viz-scroll" role="region" aria-label="Stability heat strip">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          preserveAspectRatio="xMinYMid meet"
          style={{ maxHeight: height + 16, display: "block" }}
        >
          <title>Stability heat strip — chronological cells per release</title>
          {sorted.map((v, i) => {
            const x = padding + i * (cellW + cellGap);
            const fillClass = colorClassForNetFix(v.netFix, maxAbsNet);
            return (
              <HoverInfo
                key={v.version}
                asChild
                title={
                  <>
                    {v.version}
                    {v.stream ? (
                      <span className="muted"> · {streamLabel(v.stream)}</span>
                    ) : null}
                  </>
                }
                body={
                  <>
                    <p>
                      {v.releaseDate ? (
                        <>
                          Released <strong>{formatReleaseDate(v.releaseDate)}</strong>{" "}
                          <span className="muted">({formatRelativeDate(v.releaseDate)})</span>
                        </>
                      ) : (
                        <span className="muted">No release date on record.</span>
                      )}
                    </p>
                    <p>
                      <strong>{v.total}</strong> parsed notes ·{" "}
                      net-fix <strong>{v.netFix >= 0 ? `+${v.netFix}` : v.netFix}</strong>
                    </p>
                    <ul>
                      <li>
                        <strong>{v.fixes}</strong> fix{v.fixes === 1 ? "" : "es"}
                      </li>
                      <li>
                        <strong>{v.knownIssues}</strong> known issue{v.knownIssues === 1 ? "" : "s"}
                        {v.blockers > 0 ? (
                          <span className="muted"> ({v.blockers} blocker{v.blockers === 1 ? "" : "s"})</span>
                        ) : null}
                      </li>
                      <li>
                        <strong>{v.breaking}</strong> breaking change{v.breaking === 1 ? "" : "s"}
                      </li>
                      {v.apiChanges > 0 ? (
                        <li>
                          <strong>{v.apiChanges}</strong> API change{v.apiChanges === 1 ? "" : "s"}
                        </li>
                      ) : null}
                      {v.security > 0 ? (
                        <li>
                          <strong>{v.security}</strong> security fix{v.security === 1 ? "" : "es"}
                        </li>
                      ) : null}
                      {v.features > 0 ? (
                        <li>
                          <strong>{v.features}</strong> new feature{v.features === 1 ? "" : "s"}
                        </li>
                      ) : null}
                      {v.mobileBlockers > 0 ? (
                        <li>
                          <strong>{v.mobileBlockers}</strong> mobile known issue{v.mobileBlockers === 1 ? "" : "s"}
                          {" "}
                          <span className="muted">(Android / iOS)</span>
                        </li>
                      ) : null}
                    </ul>
                  </>
                }
                footer={
                  <a href={`/releases/${encodeURIComponent(v.version)}`}>
                    Open release detail →
                  </a>
                }
              >
                <g className={`viz-cell ${fillClass}`}>
                  <a href={`/releases/${encodeURIComponent(v.version)}`}>
                    <rect
                      x={x}
                      y={20}
                      width={cellW}
                      height={cellH}
                      rx={2}
                      ry={2}
                    />
                    {v.mobileBlockers > 0 ? (
                      <circle
                        cx={x + cellW / 2}
                        cy={20 + cellH + 8}
                        r={2.5}
                        className="viz-cell__mobile-dot"
                      />
                    ) : null}
                  </a>
                </g>
              </HoverInfo>
            );
          })}
          <text
            x={padding}
            y={14}
            className="viz-axis-label"
            textAnchor="start"
          >
            ← older
          </text>
          <text
            x={width - padding}
            y={14}
            className="viz-axis-label"
            textAnchor="end"
          >
            newer →
          </text>
        </svg>
      </div>
    </div>
  );
}

function colorClassForNetFix(netFix: number, maxAbs: number): string {
  if (netFix === 0) return "viz-cell--neutral";
  const intensity = Math.min(1, Math.abs(netFix) / Math.max(1, maxAbs));
  if (netFix > 0) {
    if (intensity > 0.66) return "viz-cell--green-strong";
    if (intensity > 0.33) return "viz-cell--green-mid";
    return "viz-cell--green-soft";
  }
  if (intensity > 0.66) return "viz-cell--red-strong";
  if (intensity > 0.33) return "viz-cell--red-mid";
  return "viz-cell--red-soft";
}

