import { listReleases } from "@/lib/db/repositories";
import { streamLabel } from "@/lib/stream-labels";
import { formatReleaseDate, formatRelativeDate } from "@/lib/format-date";
import { paginateItems, type PaginationResult } from "@/lib/pagination";
import {
  buildReleaseFilters,
  defaultReleaseFilters,
  indexedGenerationsLabel,
  parseReleaseSortKey,
  parseSelectedReleaseFilters,
  releaseMatchesSelectedFilters,
  releasePageHref,
  sortReleasesByScore,
  type ReleaseFilterValue,
  type ReleaseSortKey
} from "@/lib/release-page-filter";
import { getScoreInputs } from "@/lib/visualizer";
import { scoreAllReleases, type ScoreResult } from "@/lib/score";
import { pageSocialMetadata } from "@/lib/site";
import { VersionPill } from "../_components/VersionPill";
import { ReleaseStreamChips } from "../_components/ReleaseStreamChips";
import { Icon } from "../_components/Icon";

export const dynamic = "force-dynamic";
const RELEASES_PER_PAGE = 50;

// Static metadata (evaluated at module load, no DB access), so it stays
// generation-neutral rather than naming lines that will change.
const RELEASES_DESCRIPTION =
  "Every indexed Unity editor release — current LTS lines by default, plus Supported, Beta, Alpha, and the legacy LTS lines when their chips are ticked. Click a version for its lane-bucketed release notes, or diff two versions in Upgrade Intelligence.";

export const metadata = {
  title: "Editor Releases",
  description: RELEASES_DESCRIPTION,
  alternates: { canonical: "/releases" },
  ...pageSocialMetadata({
    title: "Editor Releases",
    description: RELEASES_DESCRIPTION,
    path: "/releases"
  })
};

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
  const sortKey = parseReleaseSortKey(params.sort);

  const [all, scoreInputs] = await Promise.all([
    safeListReleases() as Promise<Release[]>,
    safeScoreInputs()
  ]);

  // Chips are derived from the releases we actually hold, so a new LTS line
  // (6000.7, or Unity 7's first) is filterable the moment it's ingested.
  // The filter values depend on the data, so this has to come after the load.
  const filterOptions = buildReleaseFilters(all);
  const selectedFilters = parseSelectedReleaseFilters(params.stream, filterOptions);
  const defaultFilters = defaultReleaseFilters(filterOptions);
  const { results: scoreResults } = scoreAllReleases(scoreInputs);
  // Note counts come straight from the cached score-inputs (which run a
  // single GROUP BY on release_note_items). Killed the parallel
  // listReleaseNoteCounts call that was doing the same aggregate
  // independently.
  const noteCountByVersion = new Map(scoreInputs.map((s) => [s.version, s.notes]));

  const filtered = all.filter((release) => releaseMatchesSelectedFilters(release, selectedFilters));
  const sorted = sortKey ? sortReleasesByScore(filtered, scoreResults, sortKey) : filtered;
  const pagination = paginateItems(sorted, firstParam(params.page), RELEASES_PER_PAGE);
  const releases = pagination.items;

  // Cycle: no sort → desc → asc → desc → … (clicking the header alternates
  // direction once a sort is active; users land on the default newest-first
  // view by removing the param manually or via filter chips).
  const nextSort: ReleaseSortKey = sortKey === "score-desc" ? "score-asc" : "score-desc";
  const scoreSortHref = releasePageHref(1, selectedFilters, nextSort, defaultFilters);

  return (
    <>
      <section className="page-header">
        <h1>Editor Releases</h1>
        <p>
          Every indexed Unity editor release. {indexedGenerationsLabel(all)} LTS
          lines are shown by default; tick a chip to add Supported / Beta /
          Alpha or the legacy LTS lines. Click a version for its lane-bucketed
          release notes, or use <a href="/">Upgrade Intelligence</a> to diff two
          of them. {filtered.length.toLocaleString()} of{" "}
          {all.length.toLocaleString()} shown.
        </p>
      </section>

      <ReleaseStreamChips selected={selectedFilters} options={filterOptions} />

      {filtered.length === 0 ? (
        <div className="releases-table-wrap">
          <div className="releases-empty-state">
            <Icon name="file-text" size={24} />
            <h2>No releases match this filter.</h2>
            <p>Try a different stream combination.</p>
          </div>
        </div>
      ) : (
        <div className="releases-table-wrap">
          <table className="dense-table releases-table tabnums">
            <thead>
              <tr>
                <th scope="col">Version</th>
                <th scope="col">Stream</th>
                <th scope="col">Released</th>
                <th scope="col">Age</th>
                <th scope="col">Notes</th>
                <th
                  scope="col"
                  aria-sort={
                    sortKey === "score-desc"
                      ? "descending"
                      : sortKey === "score-asc"
                        ? "ascending"
                        : undefined
                  }
                >
                  <a
                    className={`releases-table__sort ${sortKey ? "releases-table__sort--active" : ""}`}
                    href={scoreSortHref}
                    aria-label={`Sort by build score ${nextSort === "score-desc" ? "descending" : "ascending"}`}
                  >
                    Build score
                    <span className="releases-table__sort-arrow" aria-hidden>
                      {sortKey === "score-desc" ? "▼" : sortKey === "score-asc" ? "▲" : "↕"}
                    </span>
                  </a>
                </th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {releases.map((release) => {
                const noteCount = noteCountByVersion.get(release.version) ?? 0;
                const score = scoreResults.get(release.version);
                return (
                  <tr key={release.version}>
                    <td data-label="Version">
                      <a
                        className="releases-table__row-link"
                        href={`/releases/${encodeURIComponent(release.version)}`}
                        aria-label={`Open parsed notes for Unity ${release.version}`}
                      />
                      <VersionPill version={release.version} stream={release.stream} hoverCard={false} />
                    </td>
                    <td data-label="Stream">
                      <span className="release-stream">
                        {streamLabel(release.stream) || "-"}
                      </span>
                    </td>
                    <td data-label="Released">
                      <span className="muted">
                        {release.release_date ? formatReleaseDate(release.release_date) : "-"}
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
                    <td data-label="Build score">
                      <ScoreCell score={score} />
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
          <ReleasePagination
            pagination={pagination}
            selectedFilters={selectedFilters}
            defaultFilters={defaultFilters}
          />
        </div>
      )}
    </>
  );
}

function ReleasePagination({
  pagination,
  selectedFilters,
  defaultFilters
}: {
  pagination: PaginationResult<Release>;
  selectedFilters: ReleaseFilterValue[];
  /** Derived per-request; passed in so page links can omit a default selection. */
  defaultFilters: ReleaseFilterValue[];
}) {
  return (
    <nav className="lane__pagination" aria-label="Editor release pagination">
      <span className="lane__pagination-status">
        Showing <strong className="tabnums">{pagination.start.toLocaleString()}</strong>
        {pagination.start !== pagination.end ? (
          <>-<strong className="tabnums">{pagination.end.toLocaleString()}</strong></>
        ) : null}
        {" of "}
        <strong className="tabnums">{pagination.totalItems.toLocaleString()}</strong> releases
      </span>
      <span className="lane__pagination-controls">
        {pagination.hasPrev ? (
          <a
            className="lane__pagination-btn"
            href={releasePageHref(pagination.page - 1, selectedFilters, null, defaultFilters)}
            rel="prev"
          >
            <Icon name="chevron-left" size={14} />
            Prev
          </a>
        ) : (
          <span className="lane__pagination-btn lane__pagination-btn--disabled" aria-disabled="true">
            <Icon name="chevron-left" size={14} />
            Prev
          </span>
        )}
        <span className="lane__pagination-page tabnums">
          Page {pagination.page} of {pagination.totalPages}
        </span>
        {pagination.hasNext ? (
          <a
            className="lane__pagination-btn"
            href={releasePageHref(pagination.page + 1, selectedFilters, null, defaultFilters)}
            rel="next"
          >
            Next
            <Icon name="chevron-right" size={14} />
          </a>
        ) : (
          <span className="lane__pagination-btn lane__pagination-btn--disabled" aria-disabled="true">
            Next
            <Icon name="chevron-right" size={14} />
          </span>
        )}
      </span>
    </nav>
  );
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function safeListReleases() {
  try {
    return await listReleases(500);
  } catch {
    return [];
  }
}

async function safeScoreInputs() {
  try {
    return await getScoreInputs();
  } catch {
    return [];
  }
}

/** Compact in-table score cell: the number + a small dot in the
 *  band color. Hovering shows the cohort. Links into the release
 *  detail page where the full badge + expander live. */
function ScoreCell({ score }: { score: ScoreResult | undefined }) {
  if (!score || score.composite == null) {
    return <span className="release-score release-score--empty">—</span>;
  }
  const band = bandFor(score.composite);
  return (
    <span
      className={`release-score release-score--${band}`}
      title={`Cohort: ${score.cohort} (${score.cohortSize})`}
    >
      <span className="release-score__dot" />
      <span className="release-score__num">{score.composite}</span>
    </span>
  );
}

function bandFor(composite: number): string {
  if (composite >= 75) return "good";
  if (composite >= 55) return "mid";
  if (composite >= 35) return "low";
  return "bad";
}
