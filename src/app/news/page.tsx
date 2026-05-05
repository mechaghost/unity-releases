import { listFeedEventsByType } from "@/lib/db/repositories";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const news = await safeListNews();

  return (
    <>
      <section className="page-header">
        <div>
          <h1>News</h1>
          <p className="muted">Official Unity blog posts and broader Unity announcements, separated from release intelligence.</p>
        </div>
      </section>
      <div className="list">
        {news.map((event) => (
          <article className="item" key={event.stable_guid}>
            <strong>{event.title}</strong>
            <p>{trimSummary(event.summary)}</p>
            <p className="muted">{new Date(event.event_time).toLocaleDateString()}</p>
            <a href={event.source_url}>Official source</a>
          </article>
        ))}
        {!news.length ? <p className="muted">No Unity news has been indexed yet.</p> : null}
      </div>
    </>
  );
}

async function safeListNews() {
  try {
    return await listFeedEventsByType("blog_post", 50);
  } catch {
    return [];
  }
}

function trimSummary(summary: string) {
  return summary.length > 320 ? `${summary.slice(0, 320).trim()}...` : summary;
}
