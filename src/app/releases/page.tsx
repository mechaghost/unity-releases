import { listReleases } from "@/lib/db/repositories";

export const dynamic = "force-dynamic";

export default async function ReleasesPage() {
  const releases = await safeListReleases();

  return (
    <>
      <section className="page-header">
        <div>
          <h1>Editor Releases</h1>
          <p className="muted">Unity 6 Editor builds indexed from official Unity release pages.</p>
        </div>
      </section>
      <div className="list">
        {releases.map((release) => (
          <article className="item" key={release.version}>
            <strong>{release.version}</strong>
            <p className="muted">
              {release.stream} · {release.release_date ? new Date(release.release_date).toLocaleDateString() : "No date"}
            </p>
            <div className="button-row">
              <a href={`/releases/${release.version}`}>Release detail</a>
              <a href={`/explorer?version=${encodeURIComponent(release.version)}`}>Search notes</a>
              <a href={release.release_page_url}>Official source</a>
            </div>
          </article>
        ))}
        {!releases.length ? <p className="muted">No editor releases have been indexed yet.</p> : null}
      </div>
    </>
  );
}

async function safeListReleases() {
  try {
    return await listReleases(100);
  } catch {
    return [];
  }
}
