import { cookies } from "next/headers";
import {
  diffRangeCounts,
  getReleaseRangeFacets,
  listReleases,
  packageVersionsAtBoundary,
  resolveDiffRange,
  searchReleaseNotesInRange,
  type PackageBoundary
} from "@/lib/db/repositories";
import type { ReleaseNoteSearchFilters } from "@/lib/search";
import {
  aggregateByPackage,
  dedupeByIssue,
  groupByVersion,
  type DedupedIssue
} from "@/lib/diff-grouping";
import { ALL_STREAMS, streamMatches } from "@/lib/stream-filter";
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
import { FilterBar } from "../_components/FilterBar";
import { ComparePicker } from "../_components/ComparePicker";

export const dynamic = "force-dynamic";

const ROWS_PER_LANE = 25;
// by-release lanes paginate via SQL OFFSET, so we only fetch the page we render.
// dedup lanes fetch a generous slice and paginate the deduped result in memory —
// 1500 rows is enough to surface ~all unique issues in any realistic diff range.
const FETCH_FOR_DEDUP = 1500;

type ReleaseNoteRow = {
  id: number;
  version: string;
  section: string;
  area: string | null;
  platforms: string[];
  package_names: string[];
  impact_kind: string;
  risk_level: string;
  body: string;
  issue_ids: string[];
  issue_links_json: unknown;
  // pg returns TIMESTAMPTZ as Date by default; some code paths feed strings.
  release_date: string | Date | null;
};

type LaneMode = "by-release" | "by-issue" | "by-package";

/**
 * Compare-only lane spec. The visual identity (id, title, variant,
 * impactPill, defaultOpen) comes from `LANE_CATALOG` so it stays in
 * lock-step with the per-release view; this layer only adds what's
 * specific to running a server-side diff query: how rows are bucketed,
 * how to count from the cheap aggregate, and the empty-state copy.
 */
type LaneDef = (typeof LANE_CATALOG)[LaneId] & {
  mode: LaneMode;
  searchFilter: Partial<Pick<ReleaseNoteSearchFilters, "impactKind" | "riskLevel">>;
  postFilter?: (row: ReleaseNoteRow) => boolean;
  countFrom: (counts: { byImpact: Record<string, number>; blockerKnownIssues: number }) => number;
  emptyMessage: string;
};

type LaneSpec = Omit<LaneDef, keyof (typeof LANE_CATALOG)[LaneId]>;

const COMPARE_LANE_SPECS: Partial<Record<LaneId, LaneSpec>> = {
  blockers: {
    mode: "by-issue",
    searchFilter: { impactKind: "known_issue", riskLevel: "blocker" },
    countFrom: (c) => c.blockerKnownIssues,
    emptyMessage: "No known blockers in this range."
  },
  breaking: {
    mode: "by-release",
    searchFilter: { impactKind: "breaking_change" },
    countFrom: (c) => c.byImpact.breaking_change ?? 0,
    emptyMessage: "No breaking changes in this range."
  },
  api: {
    mode: "by-release",
    searchFilter: { impactKind: "api_change" },
    countFrom: (c) => c.byImpact.api_change ?? 0,
    emptyMessage: "No API changes in this range."
  },
  known: {
    mode: "by-issue",
    searchFilter: { impactKind: "known_issue" },
    postFilter: (r) => r.risk_level !== "blocker",
    countFrom: (c) => Math.max((c.byImpact.known_issue ?? 0) - c.blockerKnownIssues, 0),
    emptyMessage: "No outstanding known issues."
  },
  security: {
    mode: "by-release",
    searchFilter: { impactKind: ["security_related_fix", "install_risk"] },
    countFrom: (c) => (c.byImpact.security_related_fix ?? 0) + (c.byImpact.install_risk ?? 0),
    emptyMessage: "No security or install-impact notes."
  },
  package: {
    mode: "by-package",
    searchFilter: { impactKind: "package_change" },
    countFrom: (c) => c.byImpact.package_change ?? 0,
    emptyMessage: "No package updates."
  },
  feature: {
    mode: "by-release",
    searchFilter: { impactKind: "feature" },
    countFrom: (c) => c.byImpact.feature ?? 0,
    emptyMessage: "No new features."
  },
  improvement: {
    mode: "by-release",
    searchFilter: { impactKind: "improvement" },
    countFrom: (c) => c.byImpact.improvement ?? 0,
    emptyMessage: "No improvements."
  },
  fix: {
    mode: "by-release",
    searchFilter: { impactKind: "fix" },
    countFrom: (c) => c.byImpact.fix ?? 0,
    emptyMessage: "No fixes."
  },
  change: {
    mode: "by-release",
    searchFilter: { impactKind: "change" },
    countFrom: (c) => c.byImpact.change ?? 0,
    emptyMessage: "No miscellaneous changes."
  }
};

const LANES: LaneDef[] = (Object.entries(COMPARE_LANE_SPECS) as [LaneId, LaneSpec][]).map(
  ([id, spec]) => ({ ...LANE_CATALOG[id], ...spec })
);

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
  const streamFilter = Array.from(ALL_STREAMS);
  const userPackagesSet = new Set(userPackages);
  const fromVersion = (params.get("from") ?? userVersion ?? "").trim();
  const toVersion = (params.get("to") ?? "").trim();
  const platform = (params.get("platform") ?? "").trim();

  // User filter state — URL is the source of truth, persona cookie is the
  // first-visit fallback. The drawer applies user changes via router.push.
  const filterState = parseFiltersFromParams(params, presetCookie ?? "balanced");

  // Compare is independent of the Editor Releases page stream checkboxes.
  // The picker dropdowns include every indexed Unity 6 stream, while the currently
  // selected from/to versions are always included so the user isn't trapped
  // out of editing a URL-supplied selection.
  const pickerReleases = allReleases.filter(
    (r) =>
      streamMatches(r.stream, streamFilter) ||
      r.version === fromVersion ||
      r.version === toVersion
  );

  if (!fromVersion || !toVersion) {
    return (
      <ComparePicker
        fromVersion={fromVersion}
        toVersion={toVersion}
        releases={pickerReleases}
      >
        <div className="empty-state">
          <h2>Compare two Unity versions</h2>
          <p>Pick a “from” and a “to” version to see what changed between them — broken down by impact lane.</p>
        </div>
      </ComparePicker>
    );
  }

  const range = await resolveDiffRange(fromVersion, toVersion, streamFilter);
  if (!range) {
    return (
      <ComparePicker
        fromVersion={fromVersion}
        toVersion={toVersion}
        releases={pickerReleases}
      >
        <div className="empty-state">
          <h2>Versions not found</h2>
          <p>One of these versions isn’t in the index yet. Try selecting from the dropdowns.</p>
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
      >
        <div className="empty-state">
          <h2>No releases in range</h2>
          <p>
            Nothing falls between <code>{fromVersion}</code> and <code>{toVersion}</code> in the compare
            scope ({streamListLabel(streamFilter)}).
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

  // Project user filters now that we know the regressions boundary
  // (earliest release_date in scope) — the toggle is a no-op without it.
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
  // already pins those — letting the user re-narrow them via the drawer is
  // handled at the lane-selection level (laneIdSelection above).
  const userSliceForLanes = { ...userSearchFilters };
  delete userSliceForLanes.impactKind;
  // riskLevel: keep, since some lanes don't pin a risk and the user may
  // genuinely want "only blocker risk across all visible lanes".
  const filtersWereNarrowed =
    Object.keys(userSliceForLanes).length > 0 || laneIdSelection !== null;

  // Aggregate counts. Without user filters, the cheap range aggregate is
  // accurate. With them, we'd need filtered per-lane counts — handled below
  // via the SQL window's total_count instead of an extra round-trip.
  const [counts, facets, ...laneRowsArr] = await Promise.all([
    diffRangeCounts(effectiveVersions, platform || undefined),
    getReleaseRangeFacets(effectiveVersions),
    ...activeLaneDefs.map((lane) => {
      const page = lanePages[lane.id];
      const offset = lane.mode === "by-release" ? (page - 1) * ROWS_PER_LANE : 0;
      const limit = lane.mode === "by-release" ? ROWS_PER_LANE : FETCH_FOR_DEDUP;
      return searchReleaseNotesInRange(
        effectiveVersions,
        { ...lane.searchFilter, ...userSliceForLanes },
        limit,
        offset
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
  // Lanes default to expanded; the user collapses individual ones by
  // clicking the lane header. State is client-side only — toggling
  // does not reload the page.
  const initialCollapsed: string[] = [];

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
  const packageBoundaries =
    packageNames.length > 0 && range.fromDate && range.toDate
      ? await safePackageBoundaries(packageNames, range.fromDate, range.toDate)
      : new Map<string, PackageBoundary>();

  const streamByVersion = new Map<string, string | null>(
    allReleases.map((r) => [r.version, r.stream])
  );

  return (
    <>
      <ComparePicker
        fromVersion={fromVersion}
        toVersion={toVersion}
        releases={pickerReleases}
      />

      <section className="page-header">
        <div className="page-header__title-row">
          <h1>{range.reversed ? "Downgrading from" : "Comparing"}</h1>
        </div>
        <div className="compare-versions" aria-label="Version range">
          <VersionPill version={fromVersion} stream={lookupStream(allReleases, fromVersion)} />
          <span className="compare-versions__arrow" aria-hidden="true">→</span>
          <VersionPill version={toVersion} stream={lookupStream(allReleases, toVersion)} />
        </div>
        <p className="muted">
          {effectiveVersions.length < fullVersions.length ? (
            <>
              Sub-range <strong>{effectiveVersions.length}</strong> of{" "}
              <strong>{fullVersions.length}</strong> releases ·{" "}
            </>
          ) : (
            <>
              Spans <strong>{fullVersions.length}</strong>{" "}
              {fullVersions.length === 1 ? "release" : "releases"} ·{" "}
            </>
          )}
          <strong className="tabnums">{counts.totalNotes.toLocaleString()}</strong> release notes
          {platform ? (
            <>
              {" · platform "}<code>{platform}</code>
            </>
          ) : null}
        </p>
        <p className="muted" style={{ fontSize: "var(--text-xs)" }}>
          {range.includedStreams.length > 0 ? (
            <>
              Scoped to {streamListLabel(range.includedStreams)} on{" "}
              {range.includedMinorLines.length === 1
                ? range.includedMinorLines[0]
                : `${range.includedMinorLines[0]}–${range.includedMinorLines[range.includedMinorLines.length - 1]}`}{" "}
              in the compare scope.
            </>
          ) : (
            <>No releases are included for this comparison.</>
          )}
        </p>
      </section>

      <CompareFacts counts={counts} />

      <FilterBar
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
  buildPageUrl
}: {
  def: LaneDef;
  fetchedRows: ReleaseNoteRow[];
  totalCount: number;
  page: number;
  streamByVersion: Map<string, string | null>;
  packageBoundaries: Map<string, PackageBoundary>;
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
          totalRowCount={totalCount}
          page={page}
          streamByVersion={streamByVersion}
          buildPageUrl={buildPageUrl}
        />
      ) : def.mode === "by-package" ? (
        <ByPackageLaneBody
          rows={fetchedRows}
          totalRowCount={totalCount}
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
  buildPageUrl
}: {
  rows: ReleaseNoteRow[];
  totalRowCount: number;
  page: number;
  streamByVersion: Map<string, string | null>;
  buildPageUrl: (nextPage: number) => string;
}) {
  // SQL has already paginated; render exactly what we got. No intra-release
  // dedup here — across pages it would silently drop rows the user is
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
            <NoteRow key={row.id} row={row} />
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
  totalRowCount,
  page,
  streamByVersion,
  buildPageUrl
}: {
  rows: ReleaseNoteRow[];
  totalRowCount: number;
  page: number;
  streamByVersion: Map<string, string | null>;
  buildPageUrl: (nextPage: number) => string;
}) {
  const deduped = dedupeByIssue(rows);
  const start = (page - 1) * ROWS_PER_LANE;
  const visible = deduped.slice(start, start + ROWS_PER_LANE);
  return (
    <>
      {visible.map((item) => (
        <DedupedIssueRow key={item.key} item={item} streamByVersion={streamByVersion} />
      ))}
      <LanePagination
        page={page}
        pageSize={ROWS_PER_LANE}
        total={deduped.length}
        itemNoun={{ singular: "unique issue", plural: "unique issues" }}
        buildPageUrl={buildPageUrl}
      />
      <div className="lane__footer lane__footer--meta">
        Across <strong className="tabnums">{totalRowCount.toLocaleString()}</strong> total mentions in this range.
      </div>
    </>
  );
}

function DedupedIssueRow({
  item,
  streamByVersion
}: {
  item: DedupedIssue<ReleaseNoteRow>;
  streamByVersion: Map<string, string | null>;
}) {
  const cleanedBody = cleanReleaseNoteText(item.primary.body ?? "");
  const issueLinks = normalizeIssueLinks(item.primary.issue_ids ?? [], item.primary.issue_links_json);
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
          {(item.primary.platforms ?? []).slice(0, 4).map((plat) => (
            <PlatformPill platform={plat} key={plat} />
          ))}
          {issueLinks.slice(0, 2).map((issue) => (
            <IssuePill id={issue.id} url={issue.url} key={issue.id} />
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
  totalRowCount,
  page,
  boundaries,
  buildPageUrl
}: {
  rows: ReleaseNoteRow[];
  totalRowCount: number;
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
      <div className="lane__footer lane__footer--meta">
        Across <strong className="tabnums">{totalRowCount.toLocaleString()}</strong> total mentions in this range.
      </div>
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

type CompareCounts = {
  totalNotes: number;
  byImpact: Record<string, number>;
  blockerKnownIssues: number;
};

function CompareFacts({ counts }: { counts: CompareCounts }) {
  const breaking = counts.byImpact.breaking_change ?? 0;
  const apiChanges = counts.byImpact.api_change ?? 0;
  const security = counts.byImpact.security_related_fix ?? 0;
  const installRisk = counts.byImpact.install_risk ?? 0;

  const facts = [
    { label: "Release notes", value: counts.totalNotes },
    { label: "Active known blockers", value: counts.blockerKnownIssues },
    { label: "Breaking changes", value: breaking },
    { label: "API changes", value: apiChanges },
    { label: "Security items", value: security },
    { label: "Install/platform items", value: installRisk }
  ];

  return (
    <section className="compare-facts" aria-label="Diff facts">
      <div className="compare-facts__top">
        <div className="compare-facts__heading">
          <Icon name="info" size={18} />
          <span>Diff facts</span>
        </div>
      </div>
      <div className="compare-facts__grid">
        {facts.map((fact) => (
          <div key={fact.label} className="compare-fact">
            <strong className="tabnums">{fact.value.toLocaleString()}</strong>
            <span>{fact.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function lookupStream(
  releases: { version: string; stream: string | null }[],
  version: string
): string | null {
  return releases.find((r) => r.version === version)?.stream ?? null;
}

async function safePackageBoundaries(
  packageNames: string[],
  fromDate: string | Date,
  toDate: string | Date
): Promise<Map<string, PackageBoundary>> {
  try {
    return await packageVersionsAtBoundary(packageNames, fromDate, toDate);
  } catch {
    return new Map();
  }
}

async function safeListReleases() {
  try {
    return (await listReleases(500)) as { version: string; stream: string | null; release_date: string | null }[];
  } catch {
    return [];
  }
}

function toUrlSearchParams(params: Record<string, string | string[] | undefined>): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((v) => out.append(key, v));
    else if (value !== undefined) out.set(key, value);
  }
  return out;
}
