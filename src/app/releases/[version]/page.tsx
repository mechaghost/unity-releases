import { getRelease, searchReleaseNotes } from "@/lib/db/repositories";

export const dynamic = "force-dynamic";

export default async function ReleasePage({ params }: { params: Promise<{ version: string }> }) {
  const { version } = await params;
  const release = await safeRelease(version);
  const notes = await safeNotes(version);

  return (
    <>
      <h1>Unity {version}</h1>
      {release ? (
        <section className="panel">
          <p>
            <strong>Stream:</strong> {release.stream}
          </p>
          <p>
            <strong>Release date:</strong> {String(release.release_date ?? "Unknown")}
          </p>
          <p>
            <a href={release.release_page_url}>Official release page</a>
          </p>
        </section>
      ) : (
        <p className="muted">Release not found in the database yet.</p>
      )}
      <h2>Release Note Items</h2>
      <div className="list">
        {notes.map((item) => (
          <article className="item" key={item.id}>
            <strong>
              {item.section} {item.area ? `· ${item.area}` : ""}
            </strong>
            <p>{item.body}</p>
          </article>
        ))}
      </div>
    </>
  );
}

async function safeRelease(version: string) {
  try {
    return await getRelease(version);
  } catch {
    return null;
  }
}

async function safeNotes(version: string) {
  try {
    return await searchReleaseNotes({ version, limit: 200 });
  } catch {
    return [];
  }
}
