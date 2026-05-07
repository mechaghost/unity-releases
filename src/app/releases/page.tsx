import { listReleases, listReleaseNoteCounts } from "@/lib/db/repositories";
import { streamLabel } from "@/lib/stream-labels";
import { formatReleaseDate, formatRelativeDate } from "@/lib/format-date";
import { VersionPill } from "../_components/VersionPill";
import { Icon } from "../_components/Icon";

export const dynamic = "force-dynamic";

type Release = {
  version: string;
  stream: string | null;
  release_date: string | null;
  release_page_url: string;
};

export default async function ReleasesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await searchParams;

  const [all, noteCounts] = await Promise.all([
    safeListReleases() as Promise<Release[]>,
    safeListReleaseNoteCounts()
  ]);

  return (
    <>
      <section className="page-header">
        <h1>Editor Releases</h1>
        <p>{all.length.toLocaleString()} Unity 6 releases tracked from official Unity sources.</p>
      </section>

      {all.length === 0 ? (
        <div className="releases-table-wrap">
          <div className="releases-empty-state">
            <Icon name="file-text" size={24} />
            <h2>No releases indexed yet.</h2>
            <p>Run ingestion to populate Editor release data.</p>
          </div>
        </div>
      ) : (
        <div className="releases-table-wrap">
          <table className="dense-table releases-table tabnums">
            <thead>
              <tr>
                <th>Version</th>
                <th>Stream</th>
                <th>Released</th>
                <th>Age</th>
                <th>Notes</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {all.map((release) => {
                const noteCount = noteCounts[release.version] ?? 0;
                return (
                  <tr key={release.version}>
                    <td data-label="Version">
                      <a
                        className="releases-table__row-link"
                        href={`/releases/${encodeURIComponent(release.version)}`}
                        aria-label={`Open parsed notes for Unity ${release.version}`}
                      />
                      <VersionPill version={release.version} stream={release.stream} />
                    </td>
                    <td data-label="Stream">
                      <span className="release-stream">
                        {streamLabel(release.stream) || "—"}
                      </span>
                    </td>
                    <td data-label="Released">
                      <span className="muted">
                        {release.release_date ? formatReleaseDate(release.release_date) : "—"}
                      </span>
                    </td>
                    <td data-label="Age">
                      <span className="muted">
                        {release.release_date ? formatRelativeDate(release.release_date) : ""}
                      </span>
                    </td>
                    <td data-label="Notes">
                      <span className="release-notes-status">
                        {noteCount > 0
                          ? `Parsed · ${noteCount.toLocaleString()} ${noteCount === 1 ? "entry" : "entries"}`
                          : "Not yet parsed"}
                      </span>
                    </td>
                    <td data-label="Actions">
                      <span className="release-actions">
                        <a
                          className="release-action"
                          href={release.release_page_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open official Unity page for ${release.version}`}
                          title="Unity page"
                        >
                          <Icon name="external-link" size={16} />
                        </a>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

async function safeListReleases() {
  try {
    return await listReleases(500);
  } catch {
    return [];
  }
}

async function safeListReleaseNoteCounts(): Promise<Record<string, number>> {
  try {
    return await listReleaseNoteCounts();
  } catch {
    return {};
  }
}
