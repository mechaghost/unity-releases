import { GROUP_LABELS, SUB_SCORES, type ScoreResult, type SubScoreGroup } from "@/lib/score";
import { HoverInfo } from "./HoverInfo";

const GROUP_ORDER: SubScoreGroup[] = ["upgradeRisk", "netCleanup", "liveDebt"];

const GROUP_BLURBS: Record<SubScoreGroup, string> = {
  upgradeRisk:
    "How costly is the upgrade itself — breaking surface, blocker rate, mobile-platform risk. 50% of the composite.",
  netCleanup:
    "Is this release making things better? Fix density + net-fix delta vs the prior patch. 30% of the composite.",
  liveDebt:
    "Known-issue noise the user lives with AFTER upgrading. 20% of the composite."
};

/**
 * Compact "Build score 64 / 100" badge with a stacked-bar showing
 * the three sub-score groups (upgrade risk / net cleanup / live debt).
 * Click anywhere on the badge to open the formula expander.
 *
 * Server-rendered — no client JS. Personas were explicit: no animated
 * dial, no gradient gauge, no emoji-encoded grade. Just numbers + a bar.
 */
export function BuildScoreBadge({
  result,
  size = "default",
  showCohort = true,
  href,
  label = "build score"
}: {
  result: ScoreResult;
  size?: "default" | "compact";
  showCohort?: boolean;
  href?: string;
  label?: string;
}) {
  if (result.insufficient || result.composite == null) {
    return (
      <div className={`score-badge score-badge--${size} score-badge--empty`}>
        <div className="score-badge__top">
          <span className="score-badge__num">—</span>
          <span className="score-badge__label">{label}</span>
        </div>
        <div className="score-badge__hint">insufficient data</div>
      </div>
    );
  }

  // Group sub-scores by group, sum their contributions for the bar segments.
  const groupContribs = new Map<SubScoreGroup, number>();
  const groupWeights = new Map<SubScoreGroup, number>();
  for (const s of result.sub) {
    groupContribs.set(s.group, (groupContribs.get(s.group) ?? 0) + s.contribution);
    groupWeights.set(s.group, (groupWeights.get(s.group) ?? 0) + s.weight);
  }

  const confidencePill = result.confidence < 1 ? "provisional" : null;
  const bandClass = bandFor(result.composite);

  const inner = (
    <div className={`score-badge score-badge--${size} ${bandClass}`}>
      <div className="score-badge__top">
        <HoverInfo
          title={`${label} · ${result.composite} of 100`}
          body={
            <>
              <p>
                <strong>{bandHeadline(result.composite)}</strong>{" "}
                {bandExplainer(result.composite)}
              </p>
              <p>
                Composite from six normalized sub-metrics. <strong>Higher = better</strong> —
                0 is the worst, 100 the best. Scored against the{" "}
                <strong>{result.cohort}</strong> cohort ({result.cohortSize} releases).
              </p>
              <p className="muted">
                Each sub-score is the percentile-rank of{" "}
                <code>log1p(min(raw, p95))</code> within the cohort, flipped to
                100 − percentile for &quot;lower-is-better&quot; metrics. Click{" "}
                <em>How this number is computed</em> on the page for the full
                per-metric table.
              </p>
            </>
          }
        >
          <span className="score-badge__title-row">
            <span className="score-badge__num">{result.composite}</span>
            <span className="score-badge__label">{label}</span>
          </span>
        </HoverInfo>
        {size === "default" ? (
          <span className="score-badge__direction" aria-hidden>
            higher = better
          </span>
        ) : null}
        {confidencePill ? (
          <HoverInfo
            title="Provisional score"
            body={
              <>
                <p>
                  Sparse data — this release has fewer parsed notes than the
                  full-confidence threshold of 20.
                </p>
                <p className="muted">
                  Each sub-score is blended {Math.round((1 - result.confidence) * 100)}%
                  toward the cohort median to avoid false precision. The score
                  will firm up as more notes are parsed.
                </p>
              </>
            }
          >
            <span className="score-badge__pill">{confidencePill}</span>
          </HoverInfo>
        ) : null}
      </div>
      {(() => {
        const bar = (
          <div
            className="score-bar"
            aria-label={`Build score ${result.composite} of 100`}
            role="img"
          >
            <div className="score-bar__track">
              {GROUP_ORDER.map((g) => {
                const contrib = groupContribs.get(g) ?? 0;
                // contrib is a 0..100 number on the same scale as composite,
                // so the segments stack to exactly the composite width.
                return (
                  <div
                    key={g}
                    className={`score-bar__fill score-bar__fill--${g}`}
                    style={{ width: `${contrib}%` }}
                  />
                );
              })}
            </div>
            <div
              className="score-bar__pointer"
              style={{ left: `${result.composite}%` }}
              aria-hidden
            />
            <div className="score-bar__scale" aria-hidden>
              <span style={{ left: "0%" }}>0</span>
              <span style={{ left: "50%" }}>50</span>
              <span style={{ left: "100%" }}>100</span>
            </div>
          </div>
        );

        // In compact size the bottom row of group stats is suppressed
        // (e.g. on the visualizer leaderboard where rows need to stay
        // tight). To preserve the info, wrap the bar itself in a hover
        // that surfaces the same breakdown on demand.
        if (size === "compact") {
          return (
            <HoverInfo
              title={`${label} breakdown`}
              body={<GroupBreakdownList result={result} />}
              footer={
                <span className="muted">
                  cohort: {result.cohort} ({result.cohortSize})
                </span>
              }
            >
              {bar}
            </HoverInfo>
          );
        }
        return bar;
      })()}
      {size === "default" ? (
        <div className="score-badge__bottom">
          {GROUP_ORDER.map((g) => {
            const contrib = groupContribs.get(g) ?? 0;
            const memberSubs = SUB_SCORES.filter((s) => s.group === g);
            const memberRows = result.sub.filter((s) => s.group === g);
            return (
              <HoverInfo
                key={g}
                title={`${GROUP_LABELS[g]} · +${Math.round(contrib)} of ${Math.round(memberSubs.reduce((acc, s) => acc + s.weight * 100, 0))}`}
                body={
                  <>
                    <p>{GROUP_BLURBS[g]}</p>
                    <ul>
                      {memberSubs.map((sub) => {
                        const row = memberRows.find((r) => r.id === sub.id);
                        return (
                          <li key={sub.id}>
                            <strong>{sub.label}</strong> · {Math.round(sub.weight * 100)}%{" "}
                            {row ? <>· score {Math.round(row.score)}</> : null}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                }
              >
                <span className="score-badge__group-stat">
                  <span className={`score-badge__group-dot score-badge__group-dot--${g}`} />
                  <span className="score-badge__group-label">{GROUP_LABELS[g]}</span>
                  <span className="score-badge__group-num">+{Math.round(contrib)}</span>
                </span>
              </HoverInfo>
            );
          })}
          {showCohort ? (
            <div className="score-badge__cohort">
              cohort: {result.cohort} ({result.cohortSize})
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return href ? <a href={href} className="score-badge__link">{inner}</a> : inner;
}

/** Compact rollup of the three group contributions for the compact-size
 *  badge's hover popover. Renders the same dot + label + "+N" shape the
 *  default-size badge shows inline, plus a one-line sub-score summary
 *  per group. */
function GroupBreakdownList({ result }: { result: ScoreResult }) {
  const groupContribs = new Map<SubScoreGroup, number>();
  for (const s of result.sub) {
    groupContribs.set(s.group, (groupContribs.get(s.group) ?? 0) + s.contribution);
  }
  return (
    <ul className="score-breakdown">
      {GROUP_ORDER.map((g) => {
        const contrib = Math.round(groupContribs.get(g) ?? 0);
        const max = Math.round(
          SUB_SCORES.filter((s) => s.group === g).reduce((acc, s) => acc + s.weight * 100, 0)
        );
        return (
          <li key={g}>
            <span className={`score-badge__group-dot score-badge__group-dot--${g}`} />
            <strong>{GROUP_LABELS[g]}</strong>
            <span className="muted"> · </span>
            +{contrib} of {max}
          </li>
        );
      })}
    </ul>
  );
}

function bandFor(composite: number): string {
  if (composite >= 75) return "score-badge--band-good";
  if (composite >= 55) return "score-badge--band-mid";
  if (composite >= 35) return "score-badge--band-low";
  return "score-badge--band-bad";
}

/** Short plain-English headline for the score's band — what a user
 *  should take away in one glance. */
function bandHeadline(composite: number): string {
  if (composite >= 75) return "Strong across the board.";
  if (composite >= 55) return "Solid for its cohort.";
  if (composite >= 35) return "Mixed signals.";
  return "Notably below cohort.";
}

/** Slightly more direction on what to do with the score. */
function bandExplainer(composite: number): string {
  if (composite >= 75)
    return "Good upgrade candidate. Spot-check the lanes against your project's stack, but no red flags from the corpus.";
  if (composite >= 55)
    return "Typical for the cohort. Read the breaking + known-issue lanes if your team is sensitive to either.";
  if (composite >= 35)
    return "At least one group is dragging — open the breakdown to see which, then read the matching lane.";
  return "Several sub-metrics are well below cohort. Read the breakdown carefully before relying on this version.";
}
