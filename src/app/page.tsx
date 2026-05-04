import { listFeedEvents } from "@/lib/db/repositories";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const events = await safeListEvents();

  return (
    <>
      <h1>Unity 6 Release Hub</h1>
      <p className="muted">
        Release-first tracking for Unity Editor releases, package updates, Hub notes, and Unity news.
      </p>
      <section className="grid">
        <div className="panel">
          <h2>Release Notes Explorer</h2>
          <p>Search dense release notes by version, section, area, platform, issue ID, package, and risk.</p>
          <a href="/explorer">Open explorer</a>
        </div>
        <div className="panel">
          <h2>Upgrade Impact</h2>
          <p>Compare Unity 6 versions and inspect fixes gained, known issues, package changes, and platform risks.</p>
          <a href="/upgrade">Compare versions</a>
        </div>
        <div className="panel">
          <h2>Watch RSS</h2>
          <p>Create a no-account filtered watch URL and RSS feed for your stack.</p>
          <a href="/watch">Build watch</a>
        </div>
      </section>

      <h2>Latest Activity</h2>
      <div className="list">
        {events.length ? (
          events.map((event) => (
            <article className="item" key={event.stable_guid}>
              <strong>{event.title}</strong>
              <p>{event.summary}</p>
              <p className="muted">
                {event.event_type} · {new Date(event.event_time).toLocaleString()}
              </p>
              <a href={event.source_url}>Official source</a>
            </article>
          ))
        ) : (
          <p className="muted">No database events yet. Run migrations and ingestion jobs to populate the feed.</p>
        )}
      </div>
    </>
  );
}

async function safeListEvents() {
  try {
    return await listFeedEvents(30);
  } catch {
    return [];
  }
}
