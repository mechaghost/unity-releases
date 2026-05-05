import { listFeedEventsByType, listPackages, listReleases } from "@/lib/db/repositories";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [releases, packages, news] = await Promise.all([
    safeListReleases(),
    safeListPackages(),
    safeListNews()
  ]);

  return (
    <>
      <section className="page-header">
        <div>
          <h1>Today</h1>
          <p className="muted">
            Release-first tracking for Unity 6 Editor builds, official packages, dense release notes, and Unity news.
          </p>
        </div>
      </section>

      <section className="grid priority-grid">
        <div className="panel">
          <h2>Latest Editor Releases</h2>
          <div className="stack-list">
            {releases.slice(0, 4).map((release) => (
              <a className="summary-row" href={`/releases/${release.version}`} key={release.version}>
                <strong>{release.version}</strong>
                <span>{release.stream}</span>
                <span>{release.release_date ? new Date(release.release_date).toLocaleDateString() : "No date"}</span>
              </a>
            ))}
          </div>
          <a href="/releases">Browse editor releases</a>
        </div>

        <div className="panel">
          <h2>Package Updates</h2>
          <div className="stack-list">
            {packages.slice(0, 5).map((pkg) => (
              <a className="summary-row" href={`/packages/${encodeURIComponent(pkg.name)}`} key={pkg.name}>
                <strong>{pkg.display_name ?? pkg.name}</strong>
                <span>{pkg.latest_version ?? "No version"}</span>
              </a>
            ))}
          </div>
          <a href="/packages">Browse official packages</a>
        </div>

        <div className="panel">
          <h2>Release Note Workbench</h2>
          <p>Find issues, fixes, package changes, and platform risk by version or stack.</p>
          <div className="button-row">
            <a className="secondary-action" href="/explorer?section=Known+Issues">
              Known issues
            </a>
            <a className="secondary-action" href="/upgrade">
              Upgrade review
            </a>
          </div>
        </div>
      </section>

      <section className="section-band">
        <header>
          <h2>Official Unity News</h2>
          <a href="/news">View all news</a>
        </header>
        <div className="list">
          {news.slice(0, 6).map((event) => (
            <article className="item" key={event.stable_guid}>
              <strong>{event.title}</strong>
              <p>{trimSummary(event.summary)}</p>
              <p className="muted">{new Date(event.event_time).toLocaleDateString()}</p>
              <a href={event.source_url}>Official source</a>
            </article>
          ))}
          {!news.length ? <p className="muted">No Unity news has been indexed yet.</p> : null}
        </div>
      </section>
    </>
  );
}

async function safeListReleases() {
  try {
    return await listReleases(8);
  } catch {
    return [];
  }
}

async function safeListPackages() {
  try {
    return await listPackages(8);
  } catch {
    return [];
  }
}

async function safeListNews() {
  try {
    return await listFeedEventsByType("blog_post", 8);
  } catch {
    return [];
  }
}

function trimSummary(summary: string) {
  return summary.length > 240 ? `${summary.slice(0, 240).trim()}...` : summary;
}
