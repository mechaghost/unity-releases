import {
  getArtifactStats,
  getDiscoursePostStats,
  getGithubStats,
  getTrafficStats,
  listIngestionFreshness,
  type ArtifactStats,
  type DiscoursePostStats,
  type GithubStats,
  type IngestionFreshness,
  type TrafficStats
} from "@/lib/db/repositories";
import { streamLabel } from "@/lib/stream-labels";
import { formatReleaseDate } from "@/lib/format-date";
import { pageSocialMetadata } from "@/lib/site";
import {
  getProductUpdateStats,
  listProductUpdateHealth,
  type ProductUpdateHealth,
  type ProductUpdateStats
} from "@/lib/product-updates/repositories";
import { PRODUCT_UPDATE_FAMILY_DETAILS } from "@/lib/product-updates/catalog";
import type { ProductUpdateFamily } from "@/lib/product-updates/types";

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
async function safeDiscourse(): Promise<DiscoursePostStats | null> {
  try {
    return await getDiscoursePostStats();
  } catch {
    return null;
  }
}
async function safeGithub(): Promise<GithubStats | null> {
  try {
    return await getGithubStats();
  } catch {
    return null;
  }
}

async function safeProductUpdates(): Promise<{
  stats: ProductUpdateStats | null;
  health: ProductUpdateHealth[];
} | null> {
  if (process.env.PRODUCT_UPDATE_UI_ENABLED !== "true") return null;
  try {
    const [stats, health] = await Promise.all([
      getProductUpdateStats(),
      listProductUpdateHealth()
    ]);
    return { stats, health };
  } catch {
    return { stats: null, health: [] };
  }
}

export default async function StatsPage() {
  const [artifacts, traffic, freshness, discourse, github, productUpdates] = await Promise.all([
    safeArtifacts(),
    safeTraffic(),
    safeFreshness(),
    safeDiscourse(),
    safeGithub(),
    safeProductUpdates()
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
          5 minutes. Analytics are self-hosted in our own database — no
          third-party trackers, no cookies, no IPs stored.
        </p>
      </section>

      <ArtifactsSection stats={artifacts} discourse={discourse} github={github} />
      <FreshnessSection freshness={freshness} />
      {productUpdates ? (
        <ProductUpdatesSection
          stats={productUpdates.stats}
          health={productUpdates.health}
        />
      ) : null}
      <TrafficSection stats={traffic} />
    </>
  );
}

function ProductUpdatesSection({
  stats,
  health
}: {
  stats: ProductUpdateStats | null;
  health: ProductUpdateHealth[];
}) {
  if (!stats) {
    return (
      <section className="stats-section">
        <h2>Optional Product Updates</h2>
        <p className="muted">
          Product Updates is enabled, but its additive database schema is not
          available yet.
        </p>
      </section>
    );
  }
  const now = Date.now();
  const degraded = health.filter(
    (target) =>
      target.status !== "active" ||
      target.consecutiveFailures > 0 ||
      (target.circuitOpenUntil !== null &&
        new Date(target.circuitOpenUntil).getTime() > now)
  );
  const neverRun = health.filter((target) => target.lastSuccessAt === null);
  const healthy = health.length - new Set([...degraded, ...neverRun]).size;
  const cards: StatCard[] = [
    { label: "Unity products", value: stats.products },
    { label: "Product updates", value: stats.updates },
    { label: "Parsed update items", value: stats.items },
    {
      label: "Optional sources",
      value: stats.sources,
      hint: `${formatNumber(stats.targets)} independently monitored targets`
    },
    {
      label: "Healthy targets",
      value: Math.max(healthy, 0),
      hint: `${formatNumber(degraded.length)} degraded · ${formatNumber(neverRun.length)} never successful`
    }
  ];

  return (
    <section className="stats-section">
      <h2>Optional Product Updates</h2>
      <p className="muted">
        Secondary Unity product changelogs. These counts and health signals use
        the isolated Product Updates tables and do not contribute to core
        Editor ingestion freshness.
      </p>
      <div className="stats-grid">
        {cards.map((card) => (
          <StatCardView key={card.label} card={card} />
        ))}
      </div>

      {stats.families.length > 0 ? (
        <div className="stats-breakdown">
          <h3 className="stats-breakdown__title">Updates by product family</h3>
          <ul className="stats-breakdown__list">
            {stats.families.map((family) => (
              <li key={family.family} className="stats-breakdown__row">
                <span>
                  {PRODUCT_UPDATE_FAMILY_DETAILS[
                    family.family as ProductUpdateFamily
                  ]?.shortName ?? family.family}{" "}
                  <span className="muted">
                    ({formatNumber(family.products)} products)
                  </span>
                </span>
                <strong className="tabnums">
                  {formatNumber(family.updates)}
                </strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {degraded.length > 0 ? (
        <div className="stats-breakdown">
          <h3 className="stats-breakdown__title">Targets needing attention</h3>
          <table className="stats-table">
            <thead>
              <tr>
                <th scope="col">Source / target</th>
                <th scope="col">Last success</th>
                <th scope="col">Failures</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {degraded.map((target) => (
                <tr key={`${target.sourceKey}:${target.targetKey}`}>
                  <td>
                    {target.sourceKey} / {target.targetKey}
                  </td>
                  <td>
                    {target.lastSuccessAt
                      ? new Date(target.lastSuccessAt)
                          .toISOString()
                          .replace("T", " ")
                          .slice(0, 16) + " UTC"
                      : "—"}
                  </td>
                  <td className="tabnums">{target.consecutiveFailures}</td>
                  <td>
                    <span className="stats-status stats-status--stale">
                      {target.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function ArtifactsSection({
  stats,
  discourse,
  github
}: {
  stats: ArtifactStats | null;
  discourse: DiscoursePostStats | null;
  github: GithubStats | null;
}) {
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
  if (discourse) {
    cards.push({
      label: "Staff discussion posts",
      value: discourse.totalPosts,
      hint: `${formatNumber(discourse.editedPosts)} edited · ${formatNumber(discourse.activeStaff)} active staff tracked`
    });
  }
  if (github) {
    cards.push({
      label: "Unity GitHub repos",
      value: github.totalRepos,
      hint: `${formatNumber(github.totalStars)} stars · ${formatNumber(github.notableRepos)} notable`
    });
  }

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
