import { GROUP_LABELS, SUB_SCORES, type ScoreResult, type SubScoreGroup } from "@/lib/score";
import { BuildScoreBadge } from "./BuildScoreBadge";

/**
 * Upgrade score card for `/compare`. Three layers:
 *   1. Aggregate badge — composite for the diff window, labelled
 *      "upgrade score" (not "build score") to disambiguate from the
 *      single-release number elsewhere on the site.
 *   2. Trajectory sparkline — score per individual patch inside the
 *      window, ordered chronologically. Recovers the trend signal the
 *      aggregate hides.
 *   3. Worst-N callout — the three patches with the lowest individual
 *      scores in the window, each linked to its release page.
 *
 * Plus a "How this number is computed" expander with the methodology
 * caveat — diffs have no organic peer cohort, so the aggregate is
 * scored against the single-release population.
 */
export function UpgradeScoreCard({
  aggregate,
  fromVersion,
  toVersion,
  trajectory
}: {
  aggregate: ScoreResult;
  fromVersion: string;
  toVersion: string;
  trajectory: Array<{ version: string; releaseDate: string | null; result: ScoreResult }>;
}) {
  // Worst-N inside the window: bottom 3 by composite, only when there
  // are enough scored patches to make the list informative.
  const scored = trajectory.filter((t) => t.result.composite != null);
  const worst = [...scored]
    .sort((a, b) => (a.result.composite ?? 0) - (b.result.composite ?? 0))
    .slice(0, 3);

  return (
    <section className="upgrade-score-card">
      <header className="upgrade-score-card__header">
        <h2 className="upgrade-score-card__title">
          Upgrade score · {fromVersion} → {toVersion}
        </h2>
      </header>

      <UpgradeScoreBadge result={aggregate} />

      {scored.length >= 2 ? (
        <Trajectory points={scored} />
      ) : null}

      {worst.length > 0 ? (
        <WorstPatches patches={worst} />
      ) : null}

      <UpgradeScoreExpander
        result={aggregate}
        fromVersion={fromVersion}
        toVersion={toVersion}
      />
    </section>
  );
}

/** A thin wrapper around BuildScoreBadge that overrides the label
 *  string. Keeps the bar/triangle/group rollup identical so users
 *  fluent in one read the other instantly. */
function UpgradeScoreBadge({ result }: { result: ScoreResult }) {
  return (
    <div className="upgrade-score-card__badge-wrap">
      <BuildScoreBadge result={result} showCohort={false} label="upgrade score" />
    </div>
  );
}

function Trajectory({
  points
}: {
  points: Array<{ version: string; releaseDate: string | null; result: ScoreResult }>;
}) {
  // Chronological order, oldest first — same direction as the heat
  // strip on /visualizer for cross-page consistency.
  const sorted = [...points].sort((a, b) => {
    const ad = a.releaseDate ?? "";
    const bd = b.releaseDate ?? "";
    return ad.localeCompare(bd);
  });

  const width = 880;
  const height = 80;
  const margin = { top: 12, right: 12, bottom: 22, left: 28 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const xStep = sorted.length > 1 ? innerW / (sorted.length - 1) : 0;
  const yScale = (composite: number) => innerH - (composite / 100) * innerH;

  const path = sorted
    .map((p, i) => {
      const x = margin.left + i * xStep;
      const y = margin.top + yScale(p.result.composite ?? 0);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="upgrade-score-trajectory">
      <div className="upgrade-score-trajectory__title">
        Build score for each release in this upgrade
      </div>
      <div className="upgrade-score-trajectory__sub">
        Every release between the two endpoints, scored individually and
        plotted in chronological order. A rising line = each patch scored
        better than the previous (branch is converging). A falling line =
        the branch destabilized across this upgrade.
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Per-patch build score across the upgrade window"
      >
        {/* gridline at 50 (cohort-median reference) */}
        <line
          x1={margin.left}
          x2={margin.left + innerW}
          y1={margin.top + yScale(50)}
          y2={margin.top + yScale(50)}
          className="viz-gridline"
          strokeDasharray="2,4"
        />
        <text
          x={margin.left - 4}
          y={margin.top + yScale(50) + 3}
          textAnchor="end"
          className="viz-axis-label"
        >
          50
        </text>
        <text x={margin.left - 4} y={margin.top + 8} textAnchor="end" className="viz-axis-label">
          100
        </text>
        <text
          x={margin.left - 4}
          y={margin.top + innerH}
          textAnchor="end"
          className="viz-axis-label"
        >
          0
        </text>
        <path d={path} className="upgrade-score-trajectory__line" fill="none" />
        {sorted.map((p, i) => {
          const x = margin.left + i * xStep;
          const y = margin.top + yScale(p.result.composite ?? 0);
          return (
            <a
              key={p.version}
              href={`/releases/${encodeURIComponent(p.version)}`}
              className="upgrade-score-trajectory__dot-link"
            >
              <title>{`${p.version} · ${p.result.composite}`}</title>
              <circle cx={x} cy={y} r={3} className="upgrade-score-trajectory__dot" />
            </a>
          );
        })}
        {sorted.length > 1 ? (
          <>
            <text
              x={margin.left}
              y={height - 4}
              textAnchor="start"
              className="viz-axis-label"
            >
              {sorted[0].version}
            </text>
            <text
              x={margin.left + innerW}
              y={height - 4}
              textAnchor="end"
              className="viz-axis-label"
            >
              {sorted[sorted.length - 1].version}
            </text>
          </>
        ) : null}
      </svg>
    </div>
  );
}

function WorstPatches({
  patches
}: {
  patches: Array<{ version: string; result: ScoreResult }>;
}) {
  return (
    <div className="upgrade-score-worst">
      <div className="upgrade-score-worst__title">Lowest-scoring patches in this upgrade</div>
      <ul className="upgrade-score-worst__list">
        {patches.map((p) => {
          const draggingGroup = identifyDraggingGroup(p.result);
          return (
            <li key={p.version} className="upgrade-score-worst__item">
              <a href={`/releases/${encodeURIComponent(p.version)}`}>
                <span className="upgrade-score-worst__version">{p.version}</span>
                <span className="upgrade-score-worst__score">{p.result.composite}</span>
                <span className="upgrade-score-worst__reason muted">
                  dragged by {GROUP_LABELS[draggingGroup].toLowerCase()}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Find the group whose actual contribution is furthest below its
 *  weight-maximum, normalized — i.e. the biggest "missed" share. Returns
 *  the canonical `SubScoreGroup` id so callers can render it via
 *  `GROUP_LABELS` (rather than relying on this function to also know
 *  the display strings). */
function identifyDraggingGroup(result: ScoreResult): SubScoreGroup {
  const groupContrib = new Map<SubScoreGroup, { contrib: number; max: number }>();
  for (const s of result.sub) {
    const entry = groupContrib.get(s.group) ?? { contrib: 0, max: 0 };
    entry.contrib += s.contribution;
    entry.max += s.weight * 100;
    groupContrib.set(s.group, entry);
  }
  let worst: SubScoreGroup = "upgradeRisk";
  let worstGap = -1;
  for (const [group, { contrib, max }] of groupContrib) {
    const gap = max > 0 ? 1 - contrib / max : 0;
    if (gap > worstGap) {
      worstGap = gap;
      worst = group;
    }
  }
  return worst;
}

function UpgradeScoreExpander({
  result,
  fromVersion,
  toVersion
}: {
  result: ScoreResult;
  fromVersion: string;
  toVersion: string;
}) {
  if (result.insufficient || result.composite == null) {
    return (
      <details className="score-expander">
        <summary>How this number is computed</summary>
        <div className="score-expander__body">
          <p className="muted">Diff window has too few parsed notes to score.</p>
        </div>
      </details>
    );
  }
  return (
    <details className="score-expander">
      <summary>How this number is computed</summary>
      <div className="score-expander__body">
        <p className="score-expander__intro">
          Upgrade scores compare a diff&apos;s <strong>aggregate rates</strong>{" "}
          (summed counts across every release in the window, normalized by total
          notes) against the single-release cohort — there is no organic peer
          set of past diffs to score against. The trajectory above shows what
          the aggregate hides.
        </p>
        <p className="score-expander__intro">
          Net-fix delta is interpreted as the <strong>bookend delta</strong>:{" "}
          <code>({toVersion}.net_fix − {fromVersion}.net_fix) / total_notes</code>.
        </p>
        <table className="score-table">
          <thead>
            <tr>
              <th>Sub-score</th>
              <th>Formula</th>
              <th>Raw</th>
              <th>%ile</th>
              <th>Weight</th>
              <th>Score</th>
              <th>Contrib</th>
            </tr>
          </thead>
          <tbody>
            {result.sub.map((sub) => {
              const def = SUB_SCORES.find((s) => s.id === sub.id);
              const rawDisplay = Number.isNaN(sub.raw) ? "—" : formatRate(sub.raw);
              return (
                <tr key={sub.id} title={def?.hint}>
                  <td>{sub.label}</td>
                  <td className="score-table__formula">{def?.formula}</td>
                  <td>
                    {rawDisplay}
                    {sub.wasClipped ? "*" : ""}
                  </td>
                  <td>{Number.isNaN(sub.raw) ? "med" : Math.round(sub.percentile)}</td>
                  <td>{Math.round(sub.weight * 100)}%</td>
                  <td>{Math.round(sub.score)}</td>
                  <td className="score-table__contrib">{sub.contribution.toFixed(1)}</td>
                </tr>
              );
            })}
            <tr className="score-table__total">
              <td colSpan={6}>Composite</td>
              <td className="score-table__contrib">{result.composite}</td>
            </tr>
          </tbody>
        </table>
        <p className="score-expander__note muted">
          * = raw value clipped at the single-release p95. Cohort:{" "}
          <strong>{result.cohort}</strong> ({result.cohortSize} releases).
        </p>
      </div>
    </details>
  );
}

function formatRate(value: number): string {
  if (value === 0) return "0";
  if (Math.abs(value) >= 1) return value.toFixed(2);
  if (Math.abs(value) >= 0.01) return value.toFixed(3);
  return value.toExponential(1);
}
