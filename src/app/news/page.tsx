import { listFeedEventsByType } from "@/lib/db/repositories";
import { ExternalLink } from "../_components/ExternalLink";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "News",
  description:
    "Mirror of the official Unity blog - secondary to release intelligence, included so you can see Unity-side announcements without leaving the site.",
  alternates: { canonical: "/news" }
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

export default async function NewsPage() {
  const news = (await safeListNews()) as FeedEvent[];

  return (
    <>
      <section className="page-header">
        <div className="page-header__title-row">
          <h1>News</h1>
        </div>
        <p>
          Mirror of the official Unity blog. Secondary to release intelligence -
          included so you can see Unity-side announcements without leaving the
          site. {news.length.toLocaleString()} posts indexed; click a title to
          read it on unity.com.
        </p>
      </section>

      <div className="table-surface"><table className="dense-table">
        <thead>
          <tr>
            <th style={{ width: 130 }}>Date</th>
            <th>Title</th>
          </tr>
        </thead>
        <tbody>
          {news.map((event) => (
            <tr key={event.stable_guid}>
              <td>
                <span className="muted tabnums">{formatDate(event.event_time)}</span>
              </td>
              <td>
                <ExternalLink href={event.source_url} className="link-internal--accent">
                  {event.title}
                </ExternalLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>

      {news.length === 0 ? (
        <div className="empty-state">
          <h2>No news indexed yet.</h2>
          <p>Run <code>npm run ingest:news</code> to fetch the Unity blog RSS.</p>
        </div>
      ) : null}
    </>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

async function safeListNews() {
  try {
    return await listFeedEventsByType("blog_post", 100);
  } catch {
    return [];
  }
}
