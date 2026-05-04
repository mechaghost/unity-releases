import { searchReleaseNotes } from "@/lib/db/repositories";

export const dynamic = "force-dynamic";

export default async function IssuePage({ params }: { params: Promise<{ issueId: string }> }) {
  const { issueId } = await params;
  const results = await safeIssue(issueId);

  return (
    <>
      <h1>{issueId}</h1>
      <p>
        <a href={`https://issuetracker.unity3d.com/issues/${issueId.toLowerCase()}`}>
          Search official Issue Tracker
        </a>
      </p>
      <div className="list">
        {results.map((item) => (
          <article className="item" key={item.id}>
            <strong>
              {item.version} · {item.section} {item.area ? `· ${item.area}` : ""}
            </strong>
            <p>{item.body}</p>
            <a href={item.source_url}>Official source</a>
          </article>
        ))}
        {!results.length && <p className="muted">No mentions found yet.</p>}
      </div>
    </>
  );
}

async function safeIssue(issueId: string) {
  try {
    return await searchReleaseNotes({ issueId });
  } catch {
    return [];
  }
}
