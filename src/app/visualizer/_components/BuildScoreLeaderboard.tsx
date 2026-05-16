import type { ScoreResult } from "@/lib/score";
import { BuildScoreBadge } from "@/app/_components/BuildScoreBadge";
import { VersionPill } from "@/app/_components/VersionPill";
import { formatReleaseDate, formatRelativeDate } from "@/lib/format-date";

export type LeaderboardRow = {
  result: ScoreResult;
  stream: string | null;
  releaseDate: string | null;
};

/**
 * Best-and-worst-N panel for the visualizer page. Each row carries the
 * release's version pill + release date alongside the score badge, so
 * the user can see *which* release scored that without having to hover.
 *
 * Click any version to drill into the release detail page (full formula
 * expander). Click any score badge to open the same page.
 */
export function BuildScoreLeaderboard({ rows }: { rows: LeaderboardRow[] }) {
  const scored = rows.filter((r) => r.result.composite != null);
  if (scored.length === 0) {
    return (
      <div className="viz-card">
        <h2>Best &amp; worst build scores</h2>
        <p className="muted">No scoreable releases yet.</p>
      </div>
    );
  }

  const sorted = [...scored].sort(
    (a, b) => (b.result.composite ?? 0) - (a.result.composite ?? 0)
  );
  const top = sorted.slice(0, 5);
  const bottom = sorted.slice(-5).reverse();

  return (
    <div className="viz-card">
      <div className="viz-card__header">
        <h2>Best &amp; worst build scores</h2>
      </div>
      <p className="viz-card__sub">
        Composite of six normalized sub-metrics, scored against the
        release&apos;s own stream cohort. Click any version or badge for
        the full formula breakdown.
      </p>
      <div className="viz-leaderboard">
        <div className="viz-leaderboard__col">
          <h3 className="viz-leaderboard__heading">Top 5</h3>
          <div className="viz-leaderboard__list">
            {top.map((row) => (
              <LeaderboardItem key={row.result.version} row={row} />
            ))}
          </div>
        </div>
        <div className="viz-leaderboard__col">
          <h3 className="viz-leaderboard__heading">Bottom 5</h3>
          <div className="viz-leaderboard__list">
            {bottom.map((row) => (
              <LeaderboardItem key={row.result.version} row={row} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeaderboardItem({ row }: { row: LeaderboardRow }) {
  return (
    <div className="leaderboard-item">
      <div className="leaderboard-item__meta">
        <VersionPill version={row.result.version} stream={row.stream} />
        {row.releaseDate ? (
          <span
            className="leaderboard-item__date muted"
            title={formatRelativeDate(row.releaseDate)}
          >
            {formatReleaseDate(row.releaseDate)}
          </span>
        ) : null}
      </div>
      <BuildScoreBadge
        result={row.result}
        size="compact"
        showCohort={false}
        href={`/releases/${encodeURIComponent(row.result.version)}`}
      />
    </div>
  );
}
