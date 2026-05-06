import { listReleases } from "@/lib/db/repositories";
import { getStreamFilter, streamMatches } from "@/lib/stream-filter";
import { getUserVersion } from "@/lib/user-version";
import { VersionPill } from "../_components/VersionPill";
import { ExternalLink } from "../_components/ExternalLink";

export const dynamic = "force-dynamic";

type Release = {
  version: string;
  stream: string | null;
  release_date: string | null;
  release_page_url: string;
  release_notes_url: string | null;
};

export default async function ReleasesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const streamFilter = (params.stream as string | undefined)?.toLowerCase() ?? "";

  const [all, userVersion, globalStreams] = await Promise.all([
    safeListReleases() as Promise<Release[]>,
    getUserVersion(),
    getStreamFilter()
  ]);

  // URL stream filter (e.g. ?stream=lts) overrides the global cookie filter
  // — clicking a quick-filter pill is an explicit narrowing/override.
  const filtered = streamFilter
    ? all.filter((r) => (r.stream ?? "").toLowerCase().includes(streamFilter))
    : all.filter((r) => streamMatches(r.stream, globalStreams));

  // Diff "from" defaults to the user's chosen Unity version. Without one,
  // fall back to the latest active-line stable so the link still does
  // something useful.
  const fallbackFrom = all.find((r) => r.stream === "Update/Supported")?.version ?? null;
  const diffFrom = userVersion ?? fallbackFrom;
  const diffLabel = userVersion ? "Diff vs yours" : "Diff vs latest";

  return (
    <>
      <section className="page-header">
        <div className="page-header__title-row">
          <h1>Editor Releases</h1>
        </div>
        <p>{filtered.length.toLocaleString()} Unity 6 releases tracked from official Unity sources.</p>
      </section>

      <nav className="filter-bar" aria-label="Stream filter">
        <FilterLink href="/releases" active={!streamFilter} label="All" />
        <FilterLink href="/releases?stream=lts" active={streamFilter === "lts"} label="LTS" />
        <FilterLink href="/releases?stream=update" active={streamFilter === "update"} label="Update/Supported" />
        <FilterLink href="/releases?stream=beta" active={streamFilter === "beta"} label="Beta" />
        <FilterLink href="/releases?stream=alpha" active={streamFilter === "alpha"} label="Alpha" />
      </nav>

      <div className="table-wrap"><table className="dense-table tabnums">
        <thead>
          <tr>
            <th style={{ width: 160 }}>Version</th>
            <th style={{ width: 180 }}>Stream</th>
            <th style={{ width: 130 }}>Released</th>
            <th>Links</th>
            <th style={{ width: 120, textAlign: "right" }}>Compare</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((release) => (
            <tr key={release.version}>
              <td>
                <VersionPill version={release.version} stream={release.stream} />
              </td>
              <td>
                <span className="muted">{release.stream ?? "—"}</span>
              </td>
              <td>
                <span className="muted">{release.release_date ? formatDate(release.release_date) : "—"}</span>
              </td>
              <td>
                <span className="cluster" style={{ gap: 8 }}>
                  <a className="link-internal--accent" href={`/releases/${encodeURIComponent(release.version)}`}>
                    Notes
                  </a>
                  <ExternalLink href={release.release_page_url}>Unity page</ExternalLink>
                  {release.release_notes_url ? (
                    <ExternalLink href={release.release_notes_url}>Markdown</ExternalLink>
                  ) : null}
                </span>
              </td>
              <td style={{ textAlign: "right" }}>
                {diffFrom && release.version !== diffFrom ? (
                  <a
                    className="btn btn--secondary btn--small"
                    href={`/compare?from=${encodeURIComponent(diffFrom)}&to=${encodeURIComponent(release.version)}`}
                    title={
                      userVersion
                        ? `Diff your version (${userVersion}) → ${release.version}`
                        : `Diff ${diffFrom} → ${release.version}`
                    }
                  >
                    {diffLabel}
                  </a>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <h2>No releases match this filter.</h2>
          <p>Try a different stream or <a href="/releases">show all releases</a>.</p>
        </div>
      ) : null}
    </>
  );
}

function FilterLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <a
      href={href}
      className={`btn btn--small ${active ? "btn--primary" : "btn--secondary"}`}
      aria-pressed={active}
    >
      {label}
    </a>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

async function safeListReleases() {
  try {
    return await listReleases(500);
  } catch {
    return [];
  }
}
