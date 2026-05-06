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

const COLLAPSED = 5;
const EXPANDED = 20;

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

  // "Latest" for the diff link = tip of the active development line.
  const latestStable = releases.find((r) => r.stream === "Update/Supported");

  return (
    <>
      <section className="page-header">
        <div className="page-header__title-row">
          <h1>Dashboard</h1>
        </div>
        <p>Release-first intelligence for Unity 6 — editor releases, package updates, blockers, and Unity news in one place.</p>
      </section>

      <div className="card-stack">
        <ExpandableCard
          title="Latest Editor releases"
          seeMoreHref="/releases"
          seeMoreLabel="All releases"
          items={releases}
          renderItem={(release) => (
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
          )}
        />

        <ExpandableCard
          title="Active known blockers"
          seeMoreHref="/releases?risk=blocker"
          seeMoreLabel="All blockers"
          items={blockers}
          emptyState={
            <div className="lane__empty">
              <Icon name="check" size={16} /> No active blockers indexed.
            </div>
          }
          renderItem={(row) => (
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
          )}
        />

        <ExpandableCard
          title="Recently updated packages"
          seeMoreHref="/packages"
          seeMoreLabel="All packages"
          items={packages}
          renderItem={(pkg) => (
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
                  <span className="chip chip--package">{pkg.latest_version ?? "—"}</span>
                  {pkg.latest_published_at ? (
                    <span className="muted" style={{ fontSize: 12 }}>
                      {formatDate(pkg.latest_published_at)}
                    </span>
                  ) : null}
                </div>
              </div>
            </article>
          )}
        />

        <ExpandableCard
          title="Latest from Unity"
          seeMoreHref="/news"
          seeMoreLabel="All news"
          items={news}
          renderItem={(event) => (
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
          )}
        />
      </div>
    </>
  );
}

type ExpandableCardProps<T> = {
  title: string;
  seeMoreHref: string;
  seeMoreLabel: string;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  emptyState?: React.ReactNode;
};

/**
 * A dashboard card that shows COLLAPSED items by default and reveals up to
 * EXPANDED total via a native <details>/<summary> toggle. After EXPANDED,
 * a "see all" link sends the user to the full list page.
 */
function ExpandableCard<T>({
  title,
  seeMoreHref,
  seeMoreLabel,
  items,
  renderItem,
  emptyState
}: ExpandableCardProps<T>) {
  const visible = items.slice(0, COLLAPSED);
  const overflow = items.slice(COLLAPSED, EXPANDED);
  const hasMoreBeyondExpanded = items.length > EXPANDED;

  return (
    <section className="card">
      <header className="card__header">
        <h2 className="card__title">{title}</h2>
        <a className="link-internal--accent" href={seeMoreHref}>
          {seeMoreLabel} →
        </a>
      </header>
      <div>
        {items.length === 0 && emptyState ? emptyState : null}
        {visible.map(renderItem)}
        {overflow.length > 0 ? (
          <details className="card__expand">
            <summary>
              <span className="card__expand-show">Show {overflow.length} more</span>
              <span className="card__expand-hide">Show fewer</span>
            </summary>
            {overflow.map(renderItem)}
            {hasMoreBeyondExpanded ? (
              <a className="card__see-more link-internal--accent" href={seeMoreHref}>
                See all {items.length}+ →
              </a>
            ) : null}
          </details>
        ) : null}
      </div>
    </section>
  );
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
    return (await listReleases(EXPANDED)) as ReleaseRow[];
  } catch {
    return [];
  }
}

async function safePackages(): Promise<PackageRow[]> {
  try {
    return (await listPackages(EXPANDED)) as PackageRow[];
  } catch {
    return [];
  }
}

async function safeNews(): Promise<FeedEvent[]> {
  try {
    return (await listFeedEventsByType("blog_post", EXPANDED)) as FeedEvent[];
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
      limit: EXPANDED
    })) as NoteRow[];
  } catch {
    return [];
  }
}
