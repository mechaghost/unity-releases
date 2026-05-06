import {
  listFeedEventsByType,
  listPackages,
  listReleases
} from "@/lib/db/repositories";
import { VersionPill } from "./_components/VersionPill";
import { ExternalLink } from "./_components/ExternalLink";

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
  const [releases, packages, news] = await Promise.all([
    safeReleases(),
    safePackages(),
    safeNews()
  ]);

  // "Latest" for the diff link = tip of the active development line.
  const latestStable = releases.find((r) => r.stream === "Update/Supported");

  return (
    <>
      <section className="page-header">
        <div className="page-header__title-row">
          <h1>Dashboard</h1>
        </div>
        <p>Release-first intelligence for Unity 6 — editor releases, package updates, and Unity news in one place.</p>
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
                {latestStable && release.version !== latestStable.version ? (
                  <a
                    className="btn btn--secondary btn--small"
                    href={`/compare?from=${encodeURIComponent(release.version)}&to=${encodeURIComponent(latestStable.version)}`}
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
              <a className="package-row__name link-internal" href={`/packages/${encodeURIComponent(pkg.name)}`}>
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

