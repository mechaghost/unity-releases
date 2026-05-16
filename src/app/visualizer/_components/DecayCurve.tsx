import { scaleTime, scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { Group } from "@visx/group";
import type { VersionAggregate } from "@/lib/visualizer";

/**
 * Known-issues vs release date, line-per-minor-line. Shows whether a
 * branch is converging (line trends down across successive patches) or
 * still bleeding. Multiple minor_lines overlay so the user can compare
 * branches side-by-side (e.g. 6000.0 LTS vs 6000.1 Tech).
 *
 * Server-rendered via visx primitives → ships as static SVG. No client JS.
 */
export function DecayCurve({ versions }: { versions: VersionAggregate[] }) {
  // Group by minor_line; ignore lines with fewer than 2 points (need a line).
  const byLine = new Map<string, VersionAggregate[]>();
  for (const v of versions) {
    if (!v.releaseDate) continue;
    const list = byLine.get(v.minorLine) ?? [];
    list.push(v);
    byLine.set(v.minorLine, list);
  }
  const lines = [...byLine.entries()]
    .map(([line, points]) => ({
      minorLine: line,
      points: points.slice().sort((a, b) => (a.releaseDate ?? "").localeCompare(b.releaseDate ?? ""))
    }))
    .filter((l) => l.points.length >= 2)
    .sort((a, b) => b.minorLine.localeCompare(a.minorLine))
    .slice(0, 6);

  if (lines.length === 0) {
    return (
      <div className="viz-card">
        <h2>Known-issues per release, by branch</h2>
        <p className="muted">Not enough release-history per branch to draw the curve.</p>
      </div>
    );
  }

  const allPoints = lines.flatMap((l) => l.points);
  const dates = allPoints.map((p) => new Date(p.releaseDate ?? ""));
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
  const maxY = Math.max(1, ...allPoints.map((p) => p.knownIssues));

  const width = 880;
  const height = 320;
  const margin = { top: 16, right: 24, bottom: 32, left: 40 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const xScale = scaleTime({
    domain: [minDate, maxDate],
    range: [0, innerW]
  });
  const yScale = scaleLinear({
    domain: [0, maxY],
    range: [innerH, 0],
    nice: true
  });

  return (
    <div className="viz-card">
      <div className="viz-card__header">
        <h2>Known-issues per release, by branch</h2>
        <div className="viz-card__legend">
          {lines.map((l, i) => (
            <span key={l.minorLine} className="viz-legend-line">
              <span
                className="viz-legend-line__swatch"
                style={{ background: PALETTE[i % PALETTE.length] }}
              />
              {l.minorLine}
            </span>
          ))}
        </div>
      </div>
      <p className="viz-card__sub">
        Each point is one release. Lower = fewer known-issue notes in that
        patch. A line trending down across patches = the branch is stabilizing.
      </p>
      <div className="viz-scroll">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Known-issue count per release over time, charted as ${lines.length} branch line${lines.length === 1 ? "" : "s"}`}
        >
          <title>Known-issues per release, by branch</title>
          <Group left={margin.left} top={margin.top}>
            {/* grid */}
            {yScale.ticks(5).map((tick) => (
              <line
                key={tick}
                x1={0}
                x2={innerW}
                y1={yScale(tick)}
                y2={yScale(tick)}
                className="viz-gridline"
              />
            ))}
            {lines.map((l, i) => (
              <g key={l.minorLine}>
                <LinePath
                  data={l.points}
                  x={(p) => xScale(new Date(p.releaseDate ?? ""))}
                  y={(p) => yScale(p.knownIssues)}
                  stroke={PALETTE[i % PALETTE.length]}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  fill="none"
                />
                {l.points.map((p) => (
                  <circle
                    key={p.version}
                    cx={xScale(new Date(p.releaseDate ?? ""))}
                    cy={yScale(p.knownIssues)}
                    r={2.5}
                    fill={PALETTE[i % PALETTE.length]}
                  >
                    <title>{`${p.version} · ${p.knownIssues} known · ${p.fixes} fixes`}</title>
                  </circle>
                ))}
              </g>
            ))}
            <AxisLeft
              scale={yScale}
              numTicks={5}
              tickClassName="viz-tick"
              hideAxisLine
              tickLineProps={{ className: "viz-tick-line" }}
            />
            <AxisBottom
              top={innerH}
              scale={xScale}
              numTicks={6}
              tickClassName="viz-tick"
              hideAxisLine
              tickLineProps={{ className: "viz-tick-line" }}
            />
          </Group>
        </svg>
      </div>
    </div>
  );
}

// Six-line palette aligned with the site's azure/earth/blocker token
// system. Earlier the chart used vivid Tailwind colors which clashed
// with every other surface and accidentally implied semantic meaning
// (red = bad?) that the curve doesn't carry. These six tokens come
// from the existing design-token scale; no new color decisions.
const PALETTE = [
  "#347F8E", // azure-500
  "#587AA0", // review color (steel)
  "#4D8A66", // success / green
  "#A0783B", // caution / amber
  "#7D786F", // gray-500 — neutral mid-line
  "#A45A5A"  // blocker / red
];

/** Inline `<style>` injects CSS variable values for each line so the
 *  legend swatch and the line are guaranteed to match without
 *  re-encoding the hex everywhere. Falls back to the PALETTE array
 *  above when consumed directly by stroke/fill props. */
export const DECAY_LINE_PALETTE = PALETTE;
