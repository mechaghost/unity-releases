import { scaleTime } from "@visx/scale";
import type { PatchCadencePoint } from "@/lib/visualizer";

/**
 * Date-axis dot plot per release stream. One row per stream
 * (LTS / TECH / STABLE / BETA / ALPHA). Reveals whether a branch is
 * being actively patched or has gone quiet.
 */
export function PatchCadenceDots({ points }: { points: PatchCadencePoint[] }) {
  if (points.length === 0) {
    return (
      <div className="viz-card">
        <h2>Patch cadence</h2>
        <p className="muted">No releases in the window.</p>
      </div>
    );
  }

  const streams = orderedStreams(points);
  const byStream = new Map<string, PatchCadencePoint[]>();
  for (const p of points) {
    const list = byStream.get(p.stream) ?? [];
    list.push(p);
    byStream.set(p.stream, list);
  }

  const dates = points.map((p) => new Date(p.releaseDate));
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

  const width = 880;
  const rowH = 36;
  const margin = { top: 24, right: 24, bottom: 32, left: 80 };
  const innerH = streams.length * rowH;
  const height = margin.top + innerH + margin.bottom;
  const innerW = width - margin.left - margin.right;

  const xScale = scaleTime({
    domain: [minDate, maxDate],
    range: [0, innerW]
  });

  return (
    <div className="viz-card">
      <div className="viz-card__header">
        <h2>Patch cadence</h2>
      </div>
      <p className="viz-card__sub">
        Each dot = one release. Gaps in a row reveal where a branch went
        quiet. Hover a dot for the version + date.
      </p>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" preserveAspectRatio="xMidYMid meet">
          {/* month ticks */}
          {xScale.ticks(8).map((tick) => (
            <g key={tick.toISOString()}>
              <line
                x1={margin.left + xScale(tick)}
                x2={margin.left + xScale(tick)}
                y1={margin.top - 8}
                y2={margin.top + innerH}
                className="viz-gridline"
              />
              <text
                x={margin.left + xScale(tick)}
                y={height - 8}
                textAnchor="middle"
                className="viz-axis-label"
              >
                {tick.toISOString().slice(0, 7)}
              </text>
            </g>
          ))}
          {streams.map((stream, ri) => {
            const y = margin.top + ri * rowH + rowH / 2;
            const dots = byStream.get(stream) ?? [];
            return (
              <g key={stream}>
                <text
                  x={margin.left - 8}
                  y={y}
                  dominantBaseline="middle"
                  textAnchor="end"
                  className="viz-axis-label viz-axis-label--strong"
                >
                  {stream}
                </text>
                {dots.map((d) => (
                  <a key={d.version} href={`/releases/${encodeURIComponent(d.version)}`}>
                    <title>{`${d.version} · ${d.releaseDate.slice(0, 10)}`}</title>
                    <circle
                      cx={margin.left + xScale(new Date(d.releaseDate))}
                      cy={y}
                      r={3.5}
                      className={`viz-dot viz-dot--${stream.toLowerCase()}`}
                    />
                  </a>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

const STREAM_ORDER = ["LTS", "STABLE", "TECH", "BETA", "ALPHA"];

function orderedStreams(points: PatchCadencePoint[]): string[] {
  const set = new Set(points.map((p) => p.stream));
  const ordered = STREAM_ORDER.filter((s) => set.has(s));
  for (const s of set) {
    if (!ordered.includes(s)) ordered.push(s);
  }
  return ordered;
}
