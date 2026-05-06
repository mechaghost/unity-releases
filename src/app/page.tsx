import {
  listFeedEventsByType,
  listPackages,
  listReleases,
  searchReleaseNotes
} from "@/lib/db/repositories";
import { VersionPill } from "./_components/VersionPill";
import { ImpactPill } from "./_components/ImpactPill";
import { RiskBadge } from "./_components/RiskBadge";
import { IssuePill } from "./_components/IssuePill";
import { ExternalLink } from "./_components/ExternalLink";
import { Icon } from "./_components/Icon";

export const dynamic = "force-dynamic";

type ReleaseRow = {
  version: string;
  stream: string | null;
  release_date: string | null;
};

type NoteRow = {
  id: number;
  version: string;
  area: string | null;
  body: string;
  impact_kind: string;
  risk_level: string;
  issue_ids: string[];
};

type PackageRow = {
  name: string;
  display_name: string | null;
  latest_version: string | null;
  latest_published_at: string | null;
};

type FeedEvent = {
  id: number;
  title: string;
  summary: string;
  event_time: string;
  source_url: string;
  stable_guid: string;
  tags: string[];
};

export default async function HomePage() {
  const [releases, packages, news, blockers] = await Promise.all([
    safeReleases(),
    safePackages(),
    safeNews(),
    safeBlockers()
  ]);

  // Latest = tip of the active development line (Update/Supported).
  // Latest LTS is shown separately as its own metric below.
  const latestStable = releases.find((r) => r.stream === "Update/Supported");
  const latestLts = releases.find((r) => r.stream === "LTS");
  const latestBeta = releases.find((r) => r.stream?.toLowerCase() === "beta");
  const latestAlpha = releases.find((r) => r.stream?.toLowerCase() === "alpha");

  return (
    <>
      <section className="page-header">
        <div className="page-header__title-row">
          <h1>Dashboard</h1>
        </div>
        <p>Release-first intelligence for Unity 6 — editor releases, package updates, blockers, and Unity news in one place.</p>
      </section>

      <section className="dashboard-strip">
        <DashboardMetric
          label="Latest stable"
          value={latestStable?.version ?? "—"}
          stream={latestStable?.stream}
          href={latestStable ? `/releases/${encodeURIComponent(latestStable.version)}` : undefined}
          sub={latestStable?.release_date ? formatDate(latestStable.release_date) : undefined}
        />
        <DashboardMetric
          label="Latest LTS"
          value={latestLts?.version ?? "—"}
          stream={latestLts?.stream}
          href={latestLts ? `/releases/${encodeURIComponent(latestLts.version)}` : undefined}
          sub={latestLts?.release_date ? formatDate(latestLts.release_date) : undefined}
        />
        <DashboardMetric
          label="Latest beta"
          value={latestBeta?.version ?? "—"}
          stream={latestBeta?.stream}
          href={latestBeta ? `/releases/${encodeURIComponent(latestBeta.version)}` : undefined}
          sub={latestBeta?.release_date ? formatDate(latestBeta.release_date) : undefined}
        />
        <DashboardMetric
          label="Latest alpha"
          value={latestAlpha?.version ?? "—"}
          stream={latestAlpha?.stream}
          href={latestAlpha ? `/releases/${encodeURIComponent(latestAlpha.version)}` : undefined}
          sub={latestAlpha?.release_date ? formatDate(latestAlpha.release_date) : undefined}
        />
        <a className="metric metric--cta" href={latestStable ? `/compare?from=${encodeURIComponent(releases[10]?.version ?? "")}&to=${encodeURIComponent(latestStable.version)}` : "/compare"}>
          <span className="metric__label">
            <Icon name="git-compare" size={14} /> Compare versions
          </span>
          <span className="metric__value">→</span>
          <span className="metric__sub">Diff between two Unity releases</span>
        </a>
      </section>

      <div className="card-grid">
        <section className="card">
          <header className="card__header">
            <h2 className="card__title">Latest Editor releases</h2>
            <a className="link-internal--accent" href="/releases">All releases →</a>
          </header>
          <div>
            {releases.slice(0, 8).map((release) => (
              <article className="row" key={release.version}>
                <span className="row__lead">
                  <VersionPill version={release.version} stream={release.stream} />
                </span>
                <div className="row__body">
                  <div className="row__title">
                    <span className="muted">{release.stream ?? "Stable"}</span>
                    {release.release_date ? (
                      <>
                        {" · "}
                        <span className="muted">{formatDate(release.release_date)}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                {latestStable && release.version !== latestStable.version ? (
                  <a
                    className="btn btn--secondary btn--small"
                    href={`/compare?from=${encodeURIComponent(release.version)}&to=${encodeURIComponent(latestStable.version)}`}
                  >
                    Diff
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="card">
          <header className="card__header">
            <h2 className="card__title">Active known blockers</h2>
            <a className="link-internal--accent" href="/releases?risk=blocker">All →</a>
          </header>
          <div>
            {blockers.length === 0 ? (
              <div className="lane__empty">
                <Icon name="check" size={16} /> No active blockers indexed.
              </div>
            ) : (
              blockers.map((row) => (
                <article className="row" key={row.id}>
                  <span className="row__lead">
                    <span className="tabnums">{row.version}</span>
                    {row.area ? <span className="muted">{row.area}</span> : null}
                  </span>
                  <div className="row__body">
                    <div className="row__title" title={row.body}>
                      {row.body}
                    </div>
                    <div className="row__pills">
                      <ImpactPill kind={row.impact_kind} />
                      <RiskBadge level={row.risk_level} />
                      {(row.issue_ids ?? []).slice(0, 2).map((id) => (
                        <IssuePill id={id} key={id} />
                      ))}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="card">
          <header className="card__header">
            <h2 className="card__title">Recently updated packages</h2>
            <a className="link-internal--accent" href="/packages">All packages →</a>
          </header>
          <div>
            {packages.slice(0, 6).map((pkg) => (
              <article className="row" key={pkg.name}>
                <span className="row__lead">
                  <span className="muted">pkg</span>
                </span>
                <div className="row__body">
                  <div className="row__title">
                    <a className="link-internal" href={`/packages/${encodeURIComponent(pkg.name)}`}>
                      {pkg.display_name ?? pkg.name}
                    </a>
                    <span className="muted"> · {pkg.name}</span>
                  </div>
                  <div className="row__pills">
                    <span className="chip chip--package">
                      {pkg.latest_version ?? "—"}
                    </span>
                    {pkg.latest_published_at ? (
                      <span className="muted" style={{ fontSize: 12 }}>
                        {formatDate(pkg.latest_published_at)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
            {packages.length === 0 ? <p className="muted">No packages indexed yet.</p> : null}
          </div>
        </section>

        <section className="card">
          <header className="card__header">
            <h2 className="card__title">Latest from Unity</h2>
            <a className="link-internal--accent" href="/news">All news →</a>
          </header>
          <div>
            {news.slice(0, 6).map((event) => (
              <article className="row" key={event.stable_guid}>
                <span className="row__lead">
                  <span className="muted">{formatDate(event.event_time)}</span>
                </span>
                <div className="row__body">
                  <div className="row__title" title={event.title}>
                    <ExternalLink href={event.source_url} className="link-internal--accent">
                      {event.title}
                    </ExternalLink>
                  </div>
                </div>
              </article>
            ))}
            {news.length === 0 ? <p className="muted">No news indexed yet.</p> : null}
          </div>
        </section>
      </div>
    </>
  );
}

function DashboardMetric({
  label,
  value,
  stream,
  href,
  sub
}: {
  label: string;
  value: string;
  stream?: string | null;
  href?: string;
  sub?: string;
}) {
  const inner = (
    <>
      <span className="metric__label">{label}</span>
      <span className="metric__value tabnums">{value}</span>
      <span className="metric__sub">
        {stream ? <span className="muted">{stream}</span> : null}
        {sub ? <span className="muted">{sub}</span> : null}
      </span>
    </>
  );
  if (href) {
    return (
      <a className="metric" href={href}>
        {inner}
      </a>
    );
  }
  return <div className="metric">{inner}</div>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

async function safeReleases(): Promise<ReleaseRow[]> {
  try {
    return (await listReleases(50)) as ReleaseRow[];
  } catch {
    return [];
  }
}

async function safePackages(): Promise<PackageRow[]> {
  try {
    return (await listPackages(8)) as PackageRow[];
  } catch {
    return [];
  }
}

async function safeNews(): Promise<FeedEvent[]> {
  try {
    return (await listFeedEventsByType("blog_post", 8)) as FeedEvent[];
  } catch {
    return [];
  }
}

async function safeBlockers(): Promise<NoteRow[]> {
  try {
    return (await searchReleaseNotes({
      riskLevel: "blocker",
      impactKind: "known_issue",
      order: "newest",
      limit: 6
    })) as NoteRow[];
  } catch {
    return [];
  }
}
