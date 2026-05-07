import { listReleases } from "@/lib/db/repositories";
import { streamLabel } from "@/lib/stream-labels";
import { VersionPill } from "../_components/VersionPill";
import { ReleaseStreamFilter } from "../_components/ReleaseStreamFilter";
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
  const params = await searchParams;
  const selectedStreams = parseSelectedStreams(params.stream);

  const all = (await safeListReleases()) as Release[];

  // The Editor Releases page is intentionally release-first and defaults to
  // the long-term stable line. Checkbox filters use repeated `stream=` params
  // (e.g. `?stream=lts&stream=beta`) and override the global sidebar filter.
  const filtered = all.filter((r) => releaseMatchesSelectedStreams(r.stream, selectedStreams));

  return (
    <>
      <section className="page-header">
        <div className="page-header__title-row">
          <h1>Editor Releases</h1>
        </div>
        <p>{filtered.length.toLocaleString()} Unity 6 releases tracked from official Unity sources.</p>
      </section>

      <ReleaseStreamFilter selected={selectedStreams} />

      <div className="table-wrap"><table className="dense-table tabnums">
        <thead>
          <tr>
            <th style={{ width: 160 }}>Version</th>
            <th style={{ width: 180 }}>Stream</th>
            <th style={{ width: 130 }}>Released</th>
            <th style={{ width: 96 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((release) => (
            <tr key={release.version}>
              <td>
                <VersionPill version={release.version} stream={release.stream} />
              </td>
              <td>
                <span className="muted">{streamLabel(release.stream) || "—"}</span>
              </td>
              <td>
                <span className="muted">{release.release_date ? formatDate(release.release_date) : "—"}</span>
              </td>
              <td>
                <span className="release-actions">
                  <a
                    className="release-action"
                    href={`/releases/${encodeURIComponent(release.version)}`}
                    aria-label={`Open parsed notes for Unity ${release.version}`}
                    title="Parsed notes"
                  >
                    <Icon name="file-text" size={16} />
                  </a>
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
          ))}
        </tbody>
      </table></div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <h2>No releases match this filter.</h2>
          <p>Try a different stream combination.</p>
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

const RELEASE_STREAMS = ["lts", "update", "beta", "alpha"] as const;
type ReleaseStreamFilterValue = (typeof RELEASE_STREAMS)[number];

function parseSelectedStreams(raw: string | string[] | undefined): ReleaseStreamFilterValue[] {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const selected = values
    .map((value) => value.toLowerCase())
    .filter((value): value is ReleaseStreamFilterValue =>
      (RELEASE_STREAMS as readonly string[]).includes(value)
    );
  return selected.length > 0 ? Array.from(new Set(selected)) : ["lts"];
}

function releaseMatchesSelectedStreams(stream: string | null, selected: ReleaseStreamFilterValue[]) {
  const normalized = (stream ?? "").toLowerCase();
  if (!normalized) return false;
  return selected.some((value) => normalized.includes(value));
}

async function safeListReleases() {
  try {
    return await listReleases(500);
  } catch {
    return [];
  }
}
