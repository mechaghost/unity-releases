import { cookies } from "next/headers";
import {
  diffRangeCounts,
  getIssueStatuses,
  getReleaseRangeFacets,
  listReleases,
  packageVersionsAtBoundary,
  resolveDiffRange,
  searchReleaseNotesInRange,
  type PackageBoundary
} from "@/lib/db/repositories";
import type { IssueStatus } from "@/lib/issue-status";
import type { ReleaseNoteSearchFilters } from "@/lib/search";
import {
  aggregateByPackage,
  dedupeByIssue,
  groupByVersion,
  type DedupedIssue
} from "@/lib/diff-grouping";
import {
  applyCompareStreamFilter,
  parseCompareStreamSelection
} from "@/lib/stream-filter";
import { streamListLabel } from "@/lib/stream-labels";
import { getUserPackages } from "@/lib/user-packages";
import { getUserVersion } from "@/lib/user-version";
import { cleanReleaseNoteText, normalizeIssueLinks } from "@/lib/release-notes/format";
import { formatReleaseDate } from "@/lib/format-date";
import { LANE_CATALOG, type LaneId } from "@/lib/lane-catalog";
import {
  filtersToSearchFilters,
  parseFiltersFromParams,
  parsePersonaCookie,
  parseSavedPresetsCookie,
  personaCookieName,
  savedPresetsCookieName
} from "@/lib/filters";
import { IssuePill } from "../_components/IssuePill";
import { PackagePill } from "../_components/PackagePill";
import { PlatformPill } from "../_components/PlatformPill";
import { ImpactPill } from "../_components/ImpactPill";
import { RiskBadge } from "../_components/RiskBadge";
import { VersionPill } from "../_components/VersionPill";
import { Icon } from "../_components/Icon";
import { NoteRow } from "../_components/NoteRow";
import { LaneCollapseProvider, LaneShell } from "../_components/ReviewLanes";
import { FilterChips, FilterTrigger } from "../_components/FilterBar";
import { ComparePicker } from "../_components/ComparePicker";
import { CopyMarkdownButton } from "../_components/CopyMarkdownButton";
import { UpgradeScoreCard } from "../_components/UpgradeScoreCard";
import { getScoreInputs } from "@/lib/visualizer";
import {
  aggregateDiffScoreInput,
  buildCohortStats,
  scoreAllReleases,
  scoreRelease
} from "@/lib/score";
import { parseUnityVersion } from "@/lib/parsers/version";
import { CopyLlmUrlButton } from "../_components/CopyLlmUrlButton";
import { pageSocialMetadata, siteUrl } from "@/lib/site";
import {
  COMPARE_DEFAULT_COLLAPSED,
  LANES,
  safeSearchInRange,
  type LaneDef,
  type ReleaseNoteRow
} from "@/lib/compare-lanes";

export const dynamic = "force-dynamic";

const ROWS_PER_LANE = 25;

export async function generateMetadata({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const from = firstStringParam(params.from);
  const to = firstStringParam(params.to);
  if (from && to) {
    const mdHref = `/compare.md?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const title = `Unity ${from} → ${to} upgrade diff`;
    const description = `Every blocker, breaking change, API change, package bump, and known issue between Unity ${from} and ${to} - bucketed by impact, with a markdown export for LLM analysis.`;
    const path = `/compare?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    return {
      title,
      description,
      alternates: {
        canonical: path,
        // Advertise the markdown twin so LLM-crawling tools can find it
        // from the HTML page without needing /llms.txt first.
        types: { "text/markdown": mdHref }
      },
      ...pageSocialMetadata({ title, description, path })
    };
  }
  // Empty state: let the root layout's default title win so `/` (which
  // re-exports this page) shows "Unity Releases - Unity 6 release & upgrade
  // intelligence" instead of a doubled-up tagline.
  const description =
    "Pick any two Unity editor versions — from Unity 6 or the 2019–2022 LTS lines, same major or across them — and see every blocker, breaking change, API change, package bump, and known issue between them, bucketed into lanes and exportable as markdown for an LLM.";
  return {
    description,
    alternates: { canonical: "/compare" },
    ...pageSocialMetadata({ title: "Compare Unity versions", description, path: "/compare" })
  };
}

function firstStringParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
// by-release lanes paginate via SQL OFFSET, so we only fetch the page we render.
// dedup lanes fetch a generous slice and paginate the deduped result in memory -
// 1500 rows is enough to surface ~all unique issues in any realistic diff range.
const FETCH_FOR_DEDUP = 1500;

export default async function ComparePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = toUrlSearchParams(await searchParams);
  const cookieJar = await cookies();
  const presetCookie = parsePersonaCookie(cookieJar.get(personaCookieName("compare"))?.value);
  const savedPresets = parseSavedPresetsCookie(
    cookieJar.get(savedPresetsCookieName("compare"))?.value
  );
  const [userVersion, allReleases, userPackages] = await Promise.all([
    getUserVersion(),
    safeListReleases(),
    getUserPackages()
  ]);
  const userPackagesSet = new Set(userPackages);
  const fromVersion = (params.get("from") ?? userVersion ?? "").trim();
  const toVersion = (params.get("to") ?? "").trim();
  const platform = (params.get("platform") ?? "").trim();

  // Stream scope is URL-driven only. A shared link with no `?stream=`
  // params always renders LTS-only so the same URL produces the same
  // diff for every reader (no cookie influence).
  const selectedStreams = parseCompareStreamSelection(params.getAll("stream"));

  // User filter state - URL is the source of truth, persona cookie is the
  // first-visit fallback. The drawer applies user changes via router.push.
  const filterState = parseFiltersFromParams(params, presetCookie ?? "balanced");

  // Picker dropdowns are scoped to the user's stream selection but
  // always force-include the current from/to so a URL-supplied selection
  // outside the scope can still be edited rather than trapping the user.
  const pickerReleases = applyCompareStreamFilter(
    allReleases,
    selectedStreams,
    fromVersion,
    toVersion
  );

  if (!fromVersion || !toVersion) {
    return (
      <>
        <LandingIntro />
        <ComparePicker
          fromVersion={fromVersion}
          toVersion={toVersion}
          releases={pickerReleases}
          selectedStreams={selectedStreams}
        >
          <CompareEmptyPreview />
        </ComparePicker>
      </>
    );
  }

  const range = await resolveDiffRange(fromVersion, toVersion, selectedStreams);
  if (!range) {
    return (
      <ComparePicker
        fromVersion={fromVersion}
        toVersion={toVersion}
        releases={pickerReleases}
        selectedStreams={selectedStreams}
      >
        <div className="empty-state">
          <h2>Versions not found</h2>
          <p>One of these versions isn’t in the index yet. Try selecting from the dropdowns.</p>
        </div>
      </ComparePicker>
    );
  }

  // Width cap on the HTML render path. The /compare.md endpoint is
  // intentionally uncapped (it's the LLM-facing "full dataset" surface
  // and a single fetch ~400 versions wide is the whole point), but the
  // on-screen view runs each lane query twice (paginated + export) and
  // adds facet aggregates + count aggregates on top — ~5x the per-row
  // cost of emitting markdown. 500 covers any realistic upgrade
  // decision (2019.4 → Unity 6 spans ~305 LTS releases) while keeping
  // the page from melting under cross-major mega-ranges.
  const MAX_HTML_COMPARE_VERSIONS = 500;
  if (range.versions.length > MAX_HTML_COMPARE_VERSIONS) {
    return (
      <ComparePicker
        fromVersion={fromVersion}
        toVersion={toVersion}
        releases={pickerReleases}
        selectedStreams={selectedStreams}
      >
        <div className="empty-state">
          <h2>Range too wide for the on-screen view</h2>
          <p>
            This selection covers <strong>{range.versions.length.toLocaleString()}</strong> in-between releases.
            The HTML page caps at {MAX_HTML_COMPARE_VERSIONS} for performance. Two ways to get the diff:
          </p>
          <ul className="empty-state__steps">
            <li>
              <strong>Fetch the markdown directly</strong> from{" "}
              <code>/compare.md?from={fromVersion}&amp;to={toVersion}</code> — that endpoint has
              no width cap and is the right tool for full-dataset / LLM use.
            </li>
            <li>
              <strong>Narrow the range</strong> using a stream chip (LTS only typically halves
              the version count), the sub-range slider, or by picking versions on the same major.
            </li>
          </ul>
        </div>
      </ComparePicker>
    );
  }

  if (range.versions.length === 0) {
    return (
      <ComparePicker
        fromVersion={fromVersion}
        toVersion={toVersion}
        releases={pickerReleases}
        selectedStreams={selectedStreams}
      >
        <div className="empty-state">
          <h2>No releases in range</h2>
          <p>
            Nothing falls between <code>{fromVersion}</code> and <code>{toVersion}</code> in the compare
            scope ({streamListLabel(selectedStreams)}).
          </p>
        </div>
      </ComparePicker>
    );
  }

  // Sub-range narrowing: if both sub_from and sub_to map to versions in
  // the resolved range, slice the range to that window before lane queries
  // run. Otherwise the picker values are ignored.
  const fullVersions = range.versions;
  let effectiveVersions = fullVersions;
  if (filterState.subFromVersion && filterState.subToVersion) {
    const aIdx = fullVersions.indexOf(filterState.subFromVersion);
    const bIdx = fullVersions.indexOf(filterState.subToVersion);
    if (aIdx >= 0 && bIdx >= 0) {
      const [lo, hi] = aIdx <= bIdx ? [aIdx, bIdx] : [bIdx, aIdx];
      effectiveVersions = fullVersions.slice(lo, hi + 1);
    }
  }

  // Upgrade-score: load the single-release population once, then compute
  // the aggregate diff score against the global ALL cohort (diffs may
  // span streams so a stream cohort doesn't apply). Per-release scores
  // for the trajectory sparkline come from the same population. Failure
  // here is non-fatal: the card just doesn't render.
  const scoreInputs = await safeScoreInputs();
  let upgradeScore: ReturnType<typeof scoreRelease> | null = null;
  let trajectory: Array<{ version: string; releaseDate: string | null; result: ReturnType<typeof scoreRelease> }> = [];
  if (scoreInputs.length > 0 && effectiveVersions.length > 0) {
    const allStats = buildCohortStats(scoreInputs);
    const diffInput = aggregateDiffScoreInput(scoreInputs, effectiveVersions, fromVersion, toVersion);
    upgradeScore = scoreRelease(diffInput, allStats, "ALL");
    const { results: perReleaseScores } = scoreAllReleases(scoreInputs);
    trajectory = effectiveVersions
      .map((v) => {
        const result = perReleaseScores.get(v);
        if (!result) return null;
        const input = scoreInputs.find((s) => s.version === v);
        return { version: v, releaseDate: input?.releaseDate ?? null, result };
      })
      .filter((x): x is { version: string; releaseDate: string | null; result: ReturnType<typeof scoreRelease> } => x != null);
  }

  // Project user filters now that we know the regressions boundary
  // (earliest release_date in scope) - the toggle is a no-op without it.
  const userSearchFilters = filtersToSearchFilters(
    filterState,
    userPackages,
    range.fromDate
  );
  if (platform && !userSearchFilters.platform) {
    // Honor the legacy ?platform= query param for back-compat.
    userSearchFilters.platform = platform;
  }

  // Per-lane page numbers come from URL params (`p_<laneId>`, 1-indexed).
  const lanePages: Record<LaneId, number> = LANES.reduce((acc, lane) => {
    acc[lane.id] = parseLanePage(params.get(`p_${lane.id}`));
    return acc;
  }, {} as Record<LaneId, number>);

  // If the user picked specific lanes in the drawer, only run those queries
  // (the others would render as empty cards). Otherwise everything runs.
  const laneIdSelection =
    filterState.lanes.length > 0 ? new Set(filterState.lanes) : null;
  const activeLaneDefs = laneIdSelection
    ? LANES.filter((l) => laneIdSelection.has(l.id))
    : LANES;

  // Build the merged filter for each lane: lane.searchFilter is the
  // impactKind/riskLevel that defines the lane bucket; user filters narrow
  // within it (search text, platforms, packages, manifest, hasTracker, …).
  // We strip impactKind/riskLevel from the user filters because the lane
  // already pins those - letting the user re-narrow them via the drawer is
  // handled at the lane-selection level (laneIdSelection above).
  const userSliceForLanes = { ...userSearchFilters };
  delete userSliceForLanes.impactKind;
  // riskLevel: keep, since some lanes don't pin a risk and the user may
  // genuinely want "only blocker risk across all visible lanes".
  const filtersWereNarrowed =
    Object.keys(userSliceForLanes).length > 0 || laneIdSelection !== null;

  // Aggregate counts. Without user filters, the cheap range aggregate is
  // accurate. With them, we'd need filtered per-lane counts - handled below
  // via the SQL window's total_count instead of an extra round-trip.
  const [counts, facets, ...laneRowsArr] = await Promise.all([
    diffRangeCounts(effectiveVersions, platform || undefined),
    getReleaseRangeFacets(effectiveVersions),
    ...activeLaneDefs.map((lane) => {
      const page = lanePages[lane.id];
      const offset = lane.mode === "by-release" ? (page - 1) * ROWS_PER_LANE : 0;
      const limit = lane.mode === "by-release" ? ROWS_PER_LANE : FETCH_FOR_DEDUP;
      // Only ask Postgres for COUNT(*) OVER() when we'll actually use
      // the SQL total. With no user filters, `diffRangeCounts` already
      // has authoritative numbers via the cheap aggregate; the window
      // would force a full match-set materialization for nothing.
      return searchReleaseNotesInRange(
        effectiveVersions,
        { ...lane.searchFilter, ...userSliceForLanes },
        limit,
        offset,
        { includeTotalCount: filtersWereNarrowed }
      ) as Promise<Array<ReleaseNoteRow & { total_count?: string | number }>>;
    })
  ]);

  const lanes = activeLaneDefs.map((def, i) => {
    const fetched = laneRowsArr[i] ?? [];
    let filtered = def.postFilter ? fetched.filter(def.postFilter) : fetched;
    // Manifest-aware filtering on the package lane only when the user
    // hasn't already opted in via the drawer's `manifestOnly` toggle.
    if (
      def.id === "package" &&
      userPackagesSet.size > 0 &&
      !filterState.manifestOnly
    ) {
      filtered = filtered.filter((row) =>
        (row.package_names ?? []).some((p) => userPackagesSet.has(p))
      );
    }
    // totalCount: the SQL window returns total_count (filtered, ignores
    // limit/offset). When user filters narrow the result, that's the
    // authoritative count. Otherwise use the cheap range aggregate.
    const sqlTotal = Number(fetched[0]?.total_count ?? 0);
    const totalCount = filtersWereNarrowed
      ? sqlTotal
      : def.countFrom(counts);
    return {
      def,
      fetchedRows: filtered,
      totalCount,
      page: lanePages[def.id]
    };
  });
  const lanesWithResults = lanes.filter((lane) => lane.totalCount > 0);
  // Compare frames the page as an upgrade decision sheet: only the
  // decision-driving lanes lead expanded. The supporting long-tail
  // lanes start collapsed so a reader can find the go/no-go signal
  // without scroll fatigue. The Package lane gets expanded when the
  // user has a manifest filter on or a non-empty user-package set,
  // since at that point packages ARE decision-relevant.
  const collapsedSet = new Set<string>(COMPARE_DEFAULT_COLLAPSED);
  if (!filterState.manifestOnly && userPackagesSet.size === 0) {
    collapsedSet.add("package");
  }
  const initialCollapsed: string[] = [...collapsedSet];

  // Resolve "what package version was shipping at each end of the diff
  // window" so the by-package lane can render `1.10.0 → 1.11.2` next to
  // each row instead of just an Editor-side mention count.
  const packageLane = lanes.find((l) => l.def.id === "package");
  const packageNames = packageLane
    ? Array.from(
        new Set(
          packageLane.fetchedRows.flatMap((r) => r.package_names ?? []).filter(Boolean)
        )
      )
    : [];
  // Thread the picker's editor minor lines into the boundary query so
  // package_versions that target a HIGHER editor than the boundary get
  // filtered out (e.g. a hypothetical `com.foo` v2 with compat
  // "6000.3" won't get picked for the 2022.3 boundary just because it
  // was published more recently). See `packageVersionsAtBoundary` for
  // the tuple-comparison details.
  const fromMinorLine = safeMinorLineOf(fromVersion);
  const toMinorLine = safeMinorLineOf(toVersion);
  const packageBoundaries =
    packageNames.length > 0 && range.fromDate && range.toDate
      ? await safePackageBoundaries(packageNames, range.fromDate, range.toDate, {
          fromEditorMinor: fromMinorLine,
          toEditorMinor: toMinorLine
        })
      : new Map<string, PackageBoundary>();

  const streamByVersion = new Map<string, string | null>(
    allReleases.map((r) => [r.version, r.stream])
  );

  // Issue-status pills only need the visible rows now. The full
  // markdown export used to be pre-rendered here (it required a second
  // lane fan-out at EXPORT_ROW_LIMIT rows each), but the download
  // button now lazy-fetches /compare.md on click. That endpoint is
  // route-cached so repeat clicks are free, and the page render skips
  // ~10 SQL queries per visit.
  const visibleIssueIds = uniqueValues(
    lanesWithResults.flatMap((l) => l.fetchedRows.flatMap((r) => r.issue_ids ?? []))
  );
  // Scope issue-status derivation to the majors actually covered by
  // the diff. A fix shipped in 6000.3.0b1 should NOT show "fixed" on a
  // known-issue row inside a 2019.4 → 2022.3 diff, because that fix
  // isn't reachable without a major upgrade. Building the set from
  // `effectiveVersions` keeps the chip honest for cross-major diffs
  // too (e.g. 2022.3 → 6000.5 includes both majors).
  const relevantMajors = new Set<number>(
    effectiveVersions
      .map((v) => Number(v.slice(0, v.indexOf("."))))
      .filter((n) => Number.isFinite(n))
  );
  const issueStatuses = await safeIssueStatuses(visibleIssueIds, relevantMajors);

  return (
    <>
      <ComparePicker
        fromVersion={fromVersion}
        toVersion={toVersion}
        releases={pickerReleases}
        selectedStreams={selectedStreams}
        streamRowEnd={
          <FilterTrigger
            filters={filterState}
            facets={facets}
            manifestPackages={userPackages}
            savedPresets={savedPresets}
            versionsInRange={fullVersions}
            preservedParams={{
              from: fromVersion,
              to: toVersion,
              ...(platform ? { platform } : {})
            }}
            basePath="/compare"
            view="compare"
          />
        }
      />

      {upgradeScore ? (
        <UpgradeScoreCard
          aggregate={upgradeScore}
          fromVersion={fromVersion}
          toVersion={toVersion}
          trajectory={trajectory}
        />
      ) : null}

      {(effectiveVersions.length < fullVersions.length || platform) ? (
        <section className="page-header">
          <p className="muted text-xs">
            {effectiveVersions.length < fullVersions.length ? (
              <>
                Sub-range <strong>{effectiveVersions.length}</strong> of{" "}
                <strong>{fullVersions.length}</strong>
                {platform ? " · " : null}
              </>
            ) : null}
            {platform ? <>platform <code>{platform}</code></> : null}
          </p>
        </section>
      ) : null}

      <UpgradeMarkdownCta
        filename={`unity-${fromVersion}-to-${toVersion}-${range.reversed ? "downgrade" : "upgrade"}`}
        downloadUrl={`/compare.md?from=${encodeURIComponent(fromVersion)}&to=${encodeURIComponent(toVersion)}`}
        llmUrl={`${siteUrl()}/compare.md?from=${encodeURIComponent(fromVersion)}&to=${encodeURIComponent(toVersion)}`}
      />

      <FilterChips
        filters={filterState}
        preservedParams={{
          from: fromVersion,
          to: toVersion,
          ...(platform ? { platform } : {})
        }}
        basePath="/compare"
      />

      <LaneCollapseProvider initialCollapsed={initialCollapsed}>
        <div className="compare-layout">
          <div>
            {lanesWithResults.map((l) => (
              <Lane
                key={l.def.id}
                def={l.def}
                fetchedRows={l.fetchedRows}
                totalCount={l.totalCount}
                page={l.page}
                streamByVersion={streamByVersion}
                packageBoundaries={packageBoundaries}
                issueStatuses={issueStatuses}
                buildPageUrl={(nextPage) =>
                  buildLanePageUrl({
                    fromVersion,
                    toVersion,
                    platform,
                    lanePages,
                    laneId: l.def.id,
                    nextPage
                  })
                }
              />
            ))}
          </div>
        </div>
      </LaneCollapseProvider>
    </>
  );
}

function Lane({
  def,
  fetchedRows,
  totalCount,
  page,
  streamByVersion,
  packageBoundaries,
  issueStatuses,
  buildPageUrl
}: {
  def: LaneDef;
  fetchedRows: ReleaseNoteRow[];
  totalCount: number;
  page: number;
  streamByVersion: Map<string, string | null>;
  packageBoundaries: Map<string, PackageBoundary>;
  issueStatuses: Map<string, IssueStatus>;
  buildPageUrl: (nextPage: number) => string;
}) {
  return (
    <LaneShell
      id={def.id}
      variant={def.variant}
      title={def.title}
      count={totalCount}
    >
      {totalCount === 0 ? (
        <div className="lane__empty">
          <Icon name="check" size={16} />
          {def.emptyMessage}
        </div>
      ) : def.mode === "by-issue" ? (
        <ByIssueLaneBody
          rows={fetchedRows}
          page={page}
          streamByVersion={streamByVersion}
          issueStatuses={issueStatuses}
          buildPageUrl={buildPageUrl}
        />
      ) : def.mode === "by-package" ? (
        <ByPackageLaneBody
          rows={fetchedRows}
          page={page}
          boundaries={packageBoundaries}
          buildPageUrl={buildPageUrl}
        />
      ) : (
        <ByReleaseLaneBody
          rows={fetchedRows}
          totalRowCount={totalCount}
          page={page}
          streamByVersion={streamByVersion}
          issueStatuses={issueStatuses}
          buildPageUrl={buildPageUrl}
        />
      )}
    </LaneShell>
  );
}

function LanePagination({
  page,
  pageSize,
  total,
  itemNoun,
  buildPageUrl
}: {
  page: number;
  pageSize: number;
  total: number;
  itemNoun: { singular: string; plural: string };
  buildPageUrl: (nextPage: number) => string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);
  const hasPrev = safePage > 1;
  const hasNext = safePage < totalPages;
  const noun = total === 1 ? itemNoun.singular : itemNoun.plural;

  return (
    <nav className="lane__pagination" aria-label="Lane pagination">
      <span className="lane__pagination-status">
        Showing <strong className="tabnums">{start.toLocaleString()}</strong>
        {start !== end ? <>–<strong className="tabnums">{end.toLocaleString()}</strong></> : null}
        {" of "}
        <strong className="tabnums">{total.toLocaleString()}</strong> {noun}
      </span>
      <span className="lane__pagination-controls">
        {hasPrev ? (
          <a className="lane__pagination-btn" href={buildPageUrl(safePage - 1)} rel="prev">
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
          Page {safePage} of {totalPages}
        </span>
        {hasNext ? (
          <a className="lane__pagination-btn" href={buildPageUrl(safePage + 1)} rel="next">
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

// ─── by-release ────────────────────────────────────────────────

function ByReleaseLaneBody({
  rows,
  totalRowCount,
  page,
  streamByVersion,
  issueStatuses,
  buildPageUrl
}: {
  rows: ReleaseNoteRow[];
  totalRowCount: number;
  page: number;
  streamByVersion: Map<string, string | null>;
  issueStatuses: Map<string, IssueStatus>;
  buildPageUrl: (nextPage: number) => string;
}) {
  // SQL has already paginated; render exactly what we got. No intra-release
  // dedup here - across pages it would silently drop rows the user is
  // expecting to see for that page index.
  const groups = groupByVersion(rows);
  return (
    <>
      {groups.map((group) => (
        <div className="lane__group" key={group.version}>
          <div className="lane__group-head">
            <VersionPill
              version={group.version}
              stream={streamByVersion.get(group.version) ?? null}
            />
            {group.releaseDate ? (
              <span className="muted tabnums lane__group-date">{formatReleaseDate(group.releaseDate)}</span>
            ) : null}
            <span className="lane__group-count muted tabnums">
              {group.rows.length} {group.rows.length === 1 ? "note" : "notes"}
            </span>
          </div>
          {group.rows.map((row) => (
            <NoteRow key={row.id} row={row} issueStatuses={issueStatuses} />
          ))}
        </div>
      ))}
      <LanePagination
        page={page}
        pageSize={ROWS_PER_LANE}
        total={totalRowCount}
        itemNoun={{ singular: "note", plural: "notes" }}
        buildPageUrl={buildPageUrl}
      />
    </>
  );
}

// ─── by-issue (dedupe by issue id / body) ──────────────────────

function ByIssueLaneBody({
  rows,
  page,
  streamByVersion,
  issueStatuses,
  buildPageUrl
}: {
  rows: ReleaseNoteRow[];
  page: number;
  streamByVersion: Map<string, string | null>;
  issueStatuses: Map<string, IssueStatus>;
  buildPageUrl: (nextPage: number) => string;
}) {
  const deduped = dedupeByIssue(rows);
  const start = (page - 1) * ROWS_PER_LANE;
  const visible = deduped.slice(start, start + ROWS_PER_LANE);
  return (
    <>
      {visible.map((item) => (
        <DedupedIssueRow
          key={item.key}
          item={item}
          streamByVersion={streamByVersion}
          issueStatuses={issueStatuses}
        />
      ))}
      <LanePagination
        page={page}
        pageSize={ROWS_PER_LANE}
        total={deduped.length}
        itemNoun={{ singular: "unique issue", plural: "unique issues" }}
        buildPageUrl={buildPageUrl}
      />
    </>
  );
}

function DedupedIssueRow({
  item,
  streamByVersion,
  issueStatuses
}: {
  item: DedupedIssue<ReleaseNoteRow>;
  streamByVersion: Map<string, string | null>;
  issueStatuses: Map<string, IssueStatus>;
}) {
  const cleanedBody = cleanReleaseNoteText(item.primary.body ?? "");
  const issueLinks = normalizeIssueLinks(item.primary.issue_ids ?? [], item.primary.issue_links_json);
  // Drop platform entries that case-insensitively duplicate one of the
  // package chips on the same row. Unity sometimes lists the package id
  // in both `package_names` and `platforms`, which would render two
  // identical chips side-by-side.
  const packageNamesLower = new Set(
    (item.primary.package_names ?? []).map((p) => p.toLowerCase())
  );
  const platforms = (item.primary.platforms ?? []).filter(
    (plat) => !packageNamesLower.has(plat.toLowerCase())
  );
  return (
    <article className="row" aria-label={`${item.primary.section} note`}>
      <div className="row__body">
        <div className="row__title row__title--wrap" title={cleanedBody}>
          {cleanedBody}
        </div>
        <div className="row__pills">
          <ImpactPill kind={item.primary.impact_kind} />
          <RiskBadge level={item.primary.risk_level} />
          {(item.primary.package_names ?? []).slice(0, 2).map((pkg) => (
            <PackagePill name={pkg} key={pkg} />
          ))}
          {platforms.slice(0, 4).map((plat) => (
            <PlatformPill platform={plat} key={plat} />
          ))}
          {issueLinks.slice(0, 2).map((issue) => (
            <IssuePill
              id={issue.id}
              url={issue.url}
              status={issueStatuses.get(issue.id) ?? null}
              key={issue.id}
            />
          ))}
        </div>
        <div className="row__seen-in">
          {item.firstVersion === item.lastVersion ? (
            <>
              Seen in{" "}
              <VersionPill
                version={item.firstVersion}
                stream={streamByVersion.get(item.firstVersion) ?? null}
              />
            </>
          ) : (
            <>
              Seen{" "}
              <VersionPill
                version={item.firstVersion}
                stream={streamByVersion.get(item.firstVersion) ?? null}
              />
              {" → "}
              <VersionPill
                version={item.lastVersion}
                stream={streamByVersion.get(item.lastVersion) ?? null}
              />{" "}
              <span className="muted">
                ({item.mentionCount.toLocaleString()} {item.mentionCount === 1 ? "mention" : "mentions"})
              </span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── by-package (aggregate by package_name) ────────────────────

function ByPackageLaneBody({
  rows,
  page,
  boundaries,
  buildPageUrl
}: {
  rows: ReleaseNoteRow[];
  page: number;
  boundaries: Map<string, PackageBoundary>;
  buildPageUrl: (nextPage: number) => string;
}) {
  const aggregated = aggregateByPackage(rows);
  const start = (page - 1) * ROWS_PER_LANE;
  const visible = aggregated.slice(start, start + ROWS_PER_LANE);
  return (
    <>
      {visible.map((item) => {
        const boundary = boundaries.get(item.packageName);
        const semverChanged =
          boundary && boundary.fromVersion && boundary.toVersion && boundary.fromVersion !== boundary.toVersion;
        return (
          <article className="row package-agg-row" key={item.packageName}>
            <span className="row__lead">
              <span className="muted">pkg</span>
            </span>
            <div className="row__body">
              <div className="row__title">
                <a
                  className="link-internal--accent"
                  href={`/packages?q=${encodeURIComponent(item.packageName)}`}
                >
                  {item.packageName}
                </a>
              </div>
              {boundary ? (
                <div className="row__seen-in">
                  {semverChanged ? (
                    <>
                      <strong className="tabnums">{boundary.fromVersion}</strong>
                      {" → "}
                      <strong className="tabnums">{boundary.toVersion}</strong>
                      {boundary.interveningCount > 0 ? (
                        <span className="muted">
                          {" "}
                          ({boundary.interveningCount} version
                          {boundary.interveningCount === 1 ? "" : "s"} between)
                        </span>
                      ) : null}
                    </>
                  ) : boundary.fromVersion ? (
                    <>
                      <span className="muted">no version change · pinned to </span>
                      <code className="tabnums">{boundary.fromVersion}</code>
                    </>
                  ) : (
                    <span className="muted">version unknown for this range</span>
                  )}
                  <span className="muted">
                    {" · "}
                    {item.mentionCount.toLocaleString()}{" "}
                    {item.mentionCount === 1 ? "Editor mention" : "Editor mentions"}
                  </span>
                </div>
              ) : (
                <div className="row__seen-in">
                  <span className="muted">
                    {item.mentionCount.toLocaleString()}{" "}
                    {item.mentionCount === 1 ? "mention" : "mentions"} ·{" "}
                  </span>
                  {item.firstVersion === item.lastVersion ? (
                    <>
                      in <code className="tabnums">{item.firstVersion}</code>
                    </>
                  ) : (
                    <>
                      <code className="tabnums">{item.firstVersion}</code>
                      {" → "}
                      <code className="tabnums">{item.lastVersion}</code>
                    </>
                  )}
                </div>
              )}
              {item.sampleBody ? (
                <div className="muted package-agg-row__sample" title={item.sampleBody}>
                  {cleanReleaseNoteText(item.sampleBody)}
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
      <LanePagination
        page={page}
        pageSize={ROWS_PER_LANE}
        total={aggregated.length}
        itemNoun={{ singular: "package", plural: "packages" }}
        buildPageUrl={buildPageUrl}
      />
    </>
  );
}

function parseLanePage(raw: string | null): number {
  if (!raw) return 1;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function buildLanePageUrl(input: {
  fromVersion: string;
  toVersion: string;
  platform: string;
  lanePages: Record<LaneId, number>;
  laneId: LaneId;
  nextPage: number;
}): string {
  const params = new URLSearchParams();
  params.set("from", input.fromVersion);
  params.set("to", input.toVersion);
  if (input.platform) params.set("platform", input.platform);
  // Preserve every other lane's page param so paginating one lane doesn't
  // silently reset the rest of the page.
  for (const [laneId, page] of Object.entries(input.lanePages)) {
    if (laneId === input.laneId) continue;
    if (page > 1) params.set(`p_${laneId}`, String(page));
  }
  if (input.nextPage > 1) {
    params.set(`p_${input.laneId}`, String(input.nextPage));
  }
  return `/compare?${params.toString()}#lane-${input.laneId}`;
}

function LandingIntro() {
  return (
    <section className="page-header">
      <h1 className="landing-intro__title">Upgrade Intelligence</h1>
      <p>
        Pick two Unity editor versions and see every blocker, breaking change, API
        change, package bump, and known issue between them - bucketed into lanes,
        filterable, and exportable as markdown for an LLM. Built for Unity developers
        deciding when (and whether) to upgrade.
      </p>
    </section>
  );
}

function CompareEmptyPreview() {
  return (
    <div className="empty-state empty-state--preview">
      <h2>Pick two versions to compare</h2>
      <p className="empty-state__lead">
        Choose your current Unity version on the left and a candidate upgrade target
        on the right. The result is a single page covering every release in between,
        bucketed into lanes - known blockers, breaking changes, API changes, security,
        package bumps, regressions, and fixes - plus a downloadable markdown export
        of the full dataset for LLM analysis.
      </p>
    </div>
  );
}

function UpgradeMarkdownCta({
  filename,
  downloadUrl,
  llmUrl
}: {
  filename: string;
  /** Relative URL the Download button hits on click. /compare.md is
   *  route-cached so repeat clicks are free, and the page render no
   *  longer has to pre-build the markdown for every visitor. */
  downloadUrl: string;
  /** Absolute URL of the equivalent `/compare.md` endpoint - gives an
   *  LLM tool a single-fetch entry point instead of a paste step. */
  llmUrl: string;
}) {
  return (
    <section className="upgrade-cta" aria-label="Download release data">
      <div className="upgrade-cta__copy">
        <h2 className="upgrade-cta__heading">Markdown export for LLMs</h2>
        <p>
          One structured markdown file containing every row in scope - the full
          dataset, not just the current page. Download it and paste, or hand
          your LLM the URL below and let it fetch the file directly.
        </p>
        <div className="upgrade-cta__llm">
          <code className="upgrade-cta__llm-url" title={llmUrl}>{llmUrl}</code>
          <CopyLlmUrlButton url={llmUrl} />
        </div>
      </div>
      <div className="upgrade-cta__action">
        <CopyMarkdownButton
          url={downloadUrl}
          filename={filename}
          label="Download Release Data"
        />
        <a className="upgrade-cta__skim" href="#lane-blockers">
          Or skim the lanes
        </a>
      </div>
    </section>
  );
}

async function safePackageBoundaries(
  packageNames: string[],
  fromDate: string | Date,
  toDate: string | Date,
  options?: { fromEditorMinor?: string | null; toEditorMinor?: string | null }
): Promise<Map<string, PackageBoundary>> {
  try {
    return await packageVersionsAtBoundary(packageNames, fromDate, toDate, options ?? {});
  } catch {
    return new Map();
  }
}

function safeMinorLineOf(version: string): string | null {
  try {
    const { major, minor } = parseUnityVersion(version);
    return `${major}.${minor}`;
  } catch {
    return null;
  }
}

async function safeListReleases() {
  try {
    return (await listReleases(500)) as { version: string; stream: string | null; release_date: string | null }[];
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

async function safeIssueStatuses(
  ids: string[],
  relevantMajors?: ReadonlySet<number>
): Promise<Map<string, IssueStatus>> {
  if (ids.length === 0) return new Map();
  try {
    return await getIssueStatuses(ids, { relevantMajors });
  } catch {
    return new Map();
  }
}

function uniqueValues<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function toUrlSearchParams(params: Record<string, string | string[] | undefined>): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((v) => out.append(key, v));
    else if (value !== undefined) out.set(key, value);
  }
  return out;
}
