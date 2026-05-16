import { SUB_SCORES, type ScoreResult } from "@/lib/score";

/**
 * Server-rendered details block. Uses `<details>` so it works without
 * client JS — the persona research was explicit that the formula must
 * survive a Discord screenshot. Expanding shows every sub-score's raw
 * value, clipping, percentile rank, weight, and contribution.
 */
export function BuildScoreExpander({
  result,
  version
}: {
  result: ScoreResult;
  version: string;
}) {
  if (result.insufficient || result.composite == null) {
    return (
      <details className="score-expander">
        <summary>How this number is computed</summary>
        <div className="score-expander__body">
          <p className="muted">
            This release has fewer than the minimum 5 parsed notes
            required to score meaningfully. We do not generate a build
            score from sparse data — see the methodology link below for
            why.
          </p>
        </div>
      </details>
    );
  }

  return (
    <details className="score-expander">
      <summary>How this number is computed</summary>
      <div className="score-expander__body">
        <p className="score-expander__intro">
          Composite = sum of <code>sub_score × weight</code> across six
          metrics. Sub-scores are <code>percentile-rank(log1p(min(raw, p95)))</code>{" "}
          within the <strong>{result.cohort}</strong> cohort
          ({result.cohortSize} releases). Sub-scores for lower-is-better
          metrics are flipped to <code>100 − percentile</code>.
        </p>
        {result.confidence < 1 ? (
          <p className="score-expander__warn">
            Confidence: {Math.round(result.confidence * 100)}%. Sparse
            data; each sub-score is blended {Math.round((1 - result.confidence) * 100)}%
            toward the cohort median to avoid false precision.
          </p>
        ) : null}
        <table className="score-table">
          <thead>
            <tr>
              <th>Sub-score</th>
              <th>Formula</th>
              <th>Raw</th>
              <th>Clip</th>
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
                  <td>
                    <a
                      href={drilldownHref(version, sub.id)}
                      className="score-table__sub-link"
                    >
                      {sub.label}
                    </a>
                  </td>
                  <td className="score-table__formula">{def?.formula}</td>
                  <td>{rawDisplay}{sub.wasClipped ? "*" : ""}</td>
                  <td>{Number.isNaN(sub.raw) ? "—" : formatRate(sub.clipped)}</td>
                  <td>{Number.isNaN(sub.raw) ? "med" : Math.round(sub.percentile)}</td>
                  <td>{Math.round(sub.weight * 100)}%</td>
                  <td>{Math.round(sub.score)}</td>
                  <td className="score-table__contrib">{sub.contribution.toFixed(1)}</td>
                </tr>
              );
            })}
            <tr className="score-table__total">
              <td colSpan={7}>Composite</td>
              <td className="score-table__contrib">{result.composite}</td>
            </tr>
          </tbody>
        </table>
        <p className="score-expander__note muted">
          * = raw value was clipped at the cohort 95th percentile to
          prevent outliers from compressing everyone else&apos;s scores.
          Sub-scores marked &quot;med&quot; substitute the cohort median
          where the input was missing (e.g. first patch on a minor line
          has no prior patch for net-fix delta).
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

/** Deep-link each sub-score into the release detail's filtered view. */
function drilldownHref(version: string, subId: string): string {
  const v = encodeURIComponent(version);
  switch (subId) {
    case "breakingSurface":
      return `/releases/${v}?lanes=breaking,api`;
    case "blockerRate":
      return `/releases/${v}?lanes=blockers`;
    case "mobileRate":
      return `/releases/${v}?lanes=known&platform=Android`;
    case "fixDensity":
      return `/releases/${v}?lanes=fix`;
    case "netFixDelta":
      return `/releases/${v}`;
    case "knownIssueRate":
      return `/releases/${v}?lanes=known`;
    default:
      return `/releases/${v}`;
  }
}
