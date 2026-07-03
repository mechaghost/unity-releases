import {
  getArtifactStats,
  getTrafficStats,
  listIngestionFreshness,
  type ArtifactStats,
  type IngestionFreshness,
  type TrafficStats
} from "@/lib/db/repositories";
import { streamLabel } from "@/lib/stream-labels";
import { formatReleaseDate } from "@/lib/format-date";
import { pageSocialMetadata } from "@/lib/site";

// Keep ISR (5-minute revalidate) for /stats — the counts only move on
// the 2×/day cron, so per-request rendering is pure waste. `force-dynamic`
// previously suppressed the `revalidate` here.
export const revalidate = 300;

const STATS_DESCRIPTION =
  "Live counts of everything Unity Releases tracks - editor versions, parsed release notes, UUM issues, packages, news posts, and resources - plus ingestion freshness and recent site traffic.";

export const metadata = {
  title: "Site Stats",
  description: STATS_DESCRIPTION,
  alternates: { canonical: "/stats" },
  ...pageSocialMetadata({ title: "Site Stats", description: STATS_DESCRIPTION, path: "/stats" })
};

type StatCard = {
  label: string;
  value: string | number;
  hint?: string;
};

async function safeArtifacts(): Promise<ArtifactStats | null> {
  try {
    return await getArtifactStats();
  } catch {
    return null;
  }
}
async function safeTraffic(): Promise<TrafficStats | null> {
  try {
    return await getTrafficStats();
  } catch {
    return null;
  }
}
async function safeFreshness(): Promise<IngestionFreshness[]> {
  try {
    return await listIngestionFreshness();
  } catch {
    return [];
  }
}

export default async function StatsPage() {
  const [artifacts, traffic, freshness] = await Promise.all([
    safeArtifacts(),
    safeTraffic(),
    safeFreshness()
  ]);

  return (
    <>
      <section className="page-header">
        <div className="page-header__title-row">
          <h1>Site Stats</h1>
        </div>
        <p>
          Live counts of every artifact this site tracks, ingestion freshness
          per data source, and recent site traffic. Updates roughly every
          5 minutes (page-level revalidate); the raw rows live in your
          Postgres so the data is always yours.
        </p>
      </section>

      <ArtifactsSection stats={artifacts} />
      <FreshnessSection freshness={freshness} />
      <TrafficSection stats={traffic} />
    </>
  );
}

function ArtifactsSection({ stats }: { stats: ArtifactStats | null }) {
  if (!stats) {
    return (
      <section className="stats-section">
        <h2>Tracked Artifacts</h2>
        <p className="muted">Database unavailable - try refreshing in a minute.</p>
      </section>
    );
  }
  const cards: StatCard[] = [
    {
      label: "Editor releases",
      value: stats.editorReleases,
      hint: stats.latestReleaseVersion ? `Latest: ${stats.latestReleaseVersion}` : undefined
    },
    {
      label: "Parsed release notes",
      value: stats.releaseNoteItems,
      hint: "lane-bucketed entries across every indexed version"
    },
    {
      label: "Tracked UUM issues",
      value: stats.trackedIssues,
      hint: "distinct issue IDs mentioned in release notes"
    },
    {
      label: "Curated packages",
      value: stats.trackedPackages,
      hint: `${formatNumber(stats.packageVersions)} versions across all`
    },
    {
      label: "Unity news posts",
      value: stats.newsPosts,
      hint: "mirrored from unity.com/blog/rss"
    },
    {
      label: "Unity 6 resources",
      value: stats.resources,
      hint: "ebooks, videos, webinars, podcasts, articles"
    }
  ];

  return (
    <section className="stats-section">
      <h2>Tracked Artifacts</h2>
      <div className="stats-grid">
        {cards.map((card) => (
          <StatCardView key={card.label} card={card} />
        ))}
      </div>

      {stats.editorReleasesByStream.length > 0 ? (
        <div className="stats-breakdown">
          <h3 className="stats-breakdown__title">Editor releases by stream</h3>
          <ul className="stats-breakdown__list">
            {stats.editorReleasesByStream.map((row) => (
              <li key={row.stream} className="stats-breakdown__row">
                <span>{streamLabel(row.stream) || row.stream || "Unknown"}</span>
                <strong className="tabnums">{formatNumber(row.count)}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {stats.latestReleaseDate ? (
        <p className="muted stats-section__footnote">
          Latest editor release dated{" "}
          <strong>{formatReleaseDate(stats.latestReleaseDate)}</strong>.
        </p>
      ) : null}
    </section>
  );
}

function FreshnessSection({ freshness }: { freshness: IngestionFreshness[] }) {
  if (freshness.length === 0) {
    return (
      <section className="stats-section">
        <h2>Ingestion Freshness</h2>
        <p className="muted">
          No ingestion runs recorded yet. The cron-all service polls every 12h
          (00:00 + 12:00 UTC); this table fills in after the first run.
        </p>
      </section>
    );
  }

  return (
    <section className="stats-section">
      <h2>Ingestion Freshness</h2>
      <p className="muted">
        How recently each upstream data source was successfully polled. The
        cron-all Railway service runs every 12 hours.
      </p>
      <table className="stats-table">
        <thead>
          <tr>
            <th scope="col">Source</th>
            <th scope="col">Last success</th>
            <th scope="col">Hours ago</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {freshness.map((row) => {
            const hours = Number.isFinite(row.hoursSinceLastSuccess)
              ? Math.round(row.hoursSinceLastSuccess * 10) / 10
              : null;
            const statusLabel = row.isStale
              ? "Stale"
              : row.lastSuccessAt
                ? "OK"
                : "Never";
            const statusClass = row.isStale
              ? "stats-status stats-status--stale"
              : row.lastSuccessAt
                ? "stats-status stats-status--ok"
                : "stats-status stats-status--never";
            return (
              <tr key={row.sourceType}>
                <td>{row.sourceType}</td>
                <td>
                  {row.lastSuccessAt
                    ? new Date(row.lastSuccessAt).toISOString().replace("T", " ").slice(0, 16) + " UTC"
                    : "—"}
                </td>
                <td className="tabnums">{hours == null ? "—" : hours.toLocaleString()}</td>
                <td>
                  <span className={statusClass}>{statusLabel}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function TrafficSection({ stats }: { stats: TrafficStats | null }) {
  if (!stats) {
    return (
      <section className="stats-section">
        <h2>Site Traffic</h2>
        <p className="muted">
          Traffic data is captured server-side via DB-backed middleware. If
          this section is empty after a fresh deploy, the page_views table
          is still warming up - check back after the first few pageviews.
        </p>
      </section>
    );
  }

  const cards: StatCard[] = [
    { label: "Pageviews · 24h", value: stats.pageViews24h },
    { label: "Pageviews · 7d", value: stats.pageViews7d },
    { label: "Pageviews · 30d", value: stats.pageViews30d },
    {
      label: "Interactions · 30d",
      value: stats.events30d,
      hint: "filter applies, copy-to-LLM, compare loads"
    }
  ];

  return (
    <section className="stats-section">
      <h2>Site Traffic</h2>
      <p className="muted">
        Pageviews tracked server-side without cookies, IP storage, or any
        third-party analytics. Bots that identify themselves in the
        user-agent string are filtered out at the middleware.
      </p>
      <div className="stats-grid">
        {cards.map((card) => (
          <StatCardView key={card.label} card={card} />
        ))}
      </div>

      {stats.topPaths7d.length > 0 ? (
        <div className="stats-breakdown">
          <h3 className="stats-breakdown__title">Top pages · last 7 days</h3>
          <ol className="stats-breakdown__list stats-breakdown__list--ranked">
            {stats.topPaths7d.map((row) => (
              <li key={row.path} className="stats-breakdown__row">
                <a href={row.path}>{row.path}</a>
                <strong className="tabnums">{formatNumber(row.views)}</strong>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {stats.eventsByType30d.length > 0 ? (
        <div className="stats-breakdown">
          <h3 className="stats-breakdown__title">Interactions by type · last 30 days</h3>
          <ul className="stats-breakdown__list">
            {stats.eventsByType30d.map((row) => (
              <li key={row.eventType} className="stats-breakdown__row">
                <span>{row.eventType}</span>
                <strong className="tabnums">{formatNumber(row.count)}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function StatCardView({ card }: { card: StatCard }) {
  return (
    <div className="stats-card">
      <div className="stats-card__value tabnums">{formatNumber(card.value)}</div>
      <div className="stats-card__label">{card.label}</div>
      {card.hint ? <div className="stats-card__hint">{card.hint}</div> : null}
    </div>
  );
}

function formatNumber(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return String(value);
  return Math.round(n).toLocaleString();
}
