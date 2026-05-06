import {
  diffRangeCounts,
  listFeedEventsByType,
  listIngestionFreshness,
  listPackages,
  listReleases,
  resolveDiffRange
} from "@/lib/db/repositories";
import { getStreamFilter, streamMatches } from "@/lib/stream-filter";
import { getUserVersion } from "@/lib/user-version";
import { VersionPill } from "./_components/VersionPill";
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
  const [allReleases, packages, news, userVersion, streamFilter, freshness] = await Promise.all([
    safeReleases(),
    safePackages(),
    safeNews(),
    getUserVersion(),
    getStreamFilter(),
    safeFreshness()
  ]);

  const fallbackFrom = allReleases.find((r) => r.stream === "Update/Supported")?.version ?? null;
  const releases = allReleases.filter(
    (r) =>
      streamMatches(r.stream, streamFilter) ||
      r.version === userVersion ||
      r.version === fallbackFrom
  );

  const diffFrom = userVersion ?? fallbackFrom;

  // Compute the contextual hero numbers: how many releases ahead of the
  // user and how many active blockers / breaking changes are on that
  // path. Cheap (one resolveDiffRange + one aggregate query).
  const heroTarget = allReleases.find((r) => r.stream === "Update/Supported");
  const hero = userVersion && heroTarget && userVersion !== heroTarget.version
    ? await safeHeroCounts(userVersion, heroTarget.version, streamFilter)
    : null;

  const staleSources = freshness.filter((f) => f.isStale);

  return (
    <>
      {staleSources.length > 0 ? (
        <div className="freshness-banner" role="status">
          <Icon name="alert-triangle" size={16} />
          <span>
            <strong>Data may be out of date.</strong>{" "}
            {staleSources.map((s) => s.sourceType).join(", ")} hasn’t reported a successful run in
            over 30 days. Run the corresponding <code>npm run ingest:*</code> job.
          </span>
        </div>
      ) : null}

      <section className="dashboard-hero">
        {userVersion && heroTarget && hero ? (
          <>
            <div className="dashboard-hero__line">
              <span className="muted">You’re on</span>
              <VersionPill version={userVersion} stream={lookupStream(allReleases, userVersion)} href={null} />
              <span className="muted">→</span>
              <span className="muted">latest stable</span>
              <VersionPill
                version={heroTarget.version}
                stream={heroTarget.stream}
                href={`/releases/${encodeURIComponent(heroTarget.version)}`}
              />
            </div>
            <p className="dashboard-hero__counts">
              <strong className="tabnums">{hero.releasesAhead}</strong>{" "}
              {hero.releasesAhead === 1 ? "release" : "releases"} between you and the latest
              {" · "}
              <strong className={hero.blockers > 0 ? "tabnums dashboard-hero__bad" : "tabnums"}>
                {hero.blockers}
              </strong>{" "}
              active known {hero.blockers === 1 ? "blocker" : "blockers"}
              {" · "}
              <strong className="tabnums">{hero.breaking}</strong> breaking{" "}
              {hero.breaking === 1 ? "change" : "changes"}
            </p>
            <div className="dashboard-hero__actions">
              <a
                className="btn btn--primary"
                href={`/compare?from=${encodeURIComponent(userVersion)}&to=${encodeURIComponent(heroTarget.version)}`}
              >
                <Icon name="git-compare" size={14} /> Open diff
              </a>
            </div>
          </>
        ) : userVersion ? (
          <>
            <div className="dashboard-hero__line">
              <span className="muted">You’re on</span>
              <VersionPill version={userVersion} stream={lookupStream(allReleases, userVersion)} href={null} />
            </div>
            <p className="dashboard-hero__counts">
              You’re on the current active-line tip. Nothing newer to diff against right now.
            </p>
          </>
        ) : (
          <>
            <h1 className="dashboard-hero__h1">Pick your Unity version to see what’s changed.</h1>
            <p className="dashboard-hero__counts">
              Unity Alerts diffs every release, package, and known issue against your current version.
              Use <strong>Pick your version</strong> in the sidebar to start.
            </p>
          </>
        )}
      </section>

      <div className="card-stack">
        <ExpandableCard
          title="Latest Editor releases"
          seeMoreHref="/releases"
          seeMoreLabel="All releases"
          items={releases}
          renderItem={(release) => (
            <article className="release-row" key={release.version}>
              <VersionPill version={release.version} stream={release.stream} />
              <span className="release-row__date muted tabnums">
                {release.release_date ? formatDate(release.release_date) : "—"}
              </span>
              <span className="release-row__cta">
                {diffFrom && release.version !== diffFrom ? (
                  <a
                    className="btn btn--secondary btn--small"
                    href={`/compare?from=${encodeURIComponent(diffFrom)}&to=${encodeURIComponent(release.version)}`}
                    title={
                      userVersion
                        ? `Diff your version (${userVersion}) → ${release.version}`
                        : `Diff ${diffFrom} → ${release.version}`
                    }
                  >
                    Diff
                  </a>
                ) : null}
              </span>
            </article>
          )}
        />

        <ExpandableCard
          title="Recently updated packages"
          seeMoreHref="/packages"
          seeMoreLabel="All packages"
          items={packages}
          renderItem={(pkg) => (
            <article className="package-row" key={pkg.name}>
              <a className="package-row__name link-internal" href={`/packages?q=${encodeURIComponent(pkg.name)}`}>
                <strong>{pkg.display_name ?? pkg.name}</strong>
                <span className="muted package-row__id">{pkg.name}</span>
              </a>
              <span className="chip chip--package tabnums package-row__version">
                {pkg.latest_version ?? "—"}
              </span>
              <span className="package-row__date muted tabnums">
                {pkg.latest_published_at ? formatDate(pkg.latest_published_at) : "—"}
              </span>
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
    // Pull a wider slice than EXPANDED for the dashboard so the hero can
    // resolve the latest target stream even when the user has filtered the
    // visible cards down.
    return (await listReleases(200)) as ReleaseRow[];
  } catch {
    return [];
  }
}

async function safeFreshness() {
  try {
    return await listIngestionFreshness();
  } catch {
    return [];
  }
}

async function safeHeroCounts(
  fromVersion: string,
  toVersion: string,
  streamFilter: string[]
): Promise<{ releasesAhead: number; blockers: number; breaking: number } | null> {
  try {
    // Hero counts are a soft "what's between me and latest" answer; if the
    // user's version isn't on the active path we just bail out gracefully.
    const range = await resolveDiffRange(fromVersion, toVersion, streamFilter);
    if (!range || range.versions.length === 0) return null;
    const counts = await diffRangeCounts(range.versions);
    return {
      releasesAhead: range.versions.length,
      blockers: counts.blockerKnownIssues,
      breaking: counts.byImpact.breaking_change ?? 0
    };
  } catch {
    return null;
  }
}

function lookupStream(
  releases: { version: string; stream: string | null }[],
  version: string
): string | null {
  return releases.find((r) => r.version === version)?.stream ?? null;
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
