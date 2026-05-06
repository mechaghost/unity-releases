import {
  diffRangeCounts,
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
  dedupWithinReleases,
  groupByVersion,
  type DedupedIssue
} from "@/lib/diff-grouping";
import { getStreamFilter, streamMatches } from "@/lib/stream-filter";
import { getUserPackages } from "@/lib/user-packages";
import { getUserVersion } from "@/lib/user-version";
import { cleanReleaseNoteText, normalizeIssueLinks } from "@/lib/release-notes/format";
import { IssuePill } from "../_components/IssuePill";
import { PackagePill } from "../_components/PackagePill";
import { PlatformPill } from "../_components/PlatformPill";
import { ImpactPill } from "../_components/ImpactPill";
import { RiskBadge } from "../_components/RiskBadge";
import { VersionPill } from "../_components/VersionPill";
import { Icon } from "../_components/Icon";

export const dynamic = "force-dynamic";

const ROWS_PER_LANE = 25;
const FETCH_FOR_BY_RELEASE = ROWS_PER_LANE * 2;
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

type LaneId =
  | "blockers"
  | "breaking"
  | "api"
  | "known"
  | "security"
  | "package"
  | "feature"
  | "improvement"
  | "fix"
  | "change";

type LaneMode = "by-release" | "by-issue" | "by-package";

type LaneDef = {
  id: LaneId;
  title: string;
  /** How rows are presented inside the lane. */
  mode: LaneMode;
  /** Filters to send to the per-lane query. */
  searchFilter: Partial<Pick<ReleaseNoteSearchFilters, "impactKind" | "riskLevel">>;
  /** Optional client-side post-filter for compound conditions the SQL builder can't express. */
  postFilter?: (row: ReleaseNoteRow) => boolean;
  /** How to compute the lane count from the cheap aggregate. */
  countFrom: (counts: { byImpact: Record<string, number>; blockerKnownIssues: number }) => number;
  defaultOpen: boolean;
  emptyMessage: string;
  variant: "blocker" | "caution" | "review" | "info" | "success";
  impactPill: string;
};

const LANES: LaneDef[] = [
  {
    id: "blockers",
    title: "Active known blockers",
    mode: "by-issue",
    searchFilter: { impactKind: "known_issue", riskLevel: "blocker" },
    countFrom: (c) => c.blockerKnownIssues,
    defaultOpen: true,
    emptyMessage: "No known blockers in this range.",
    variant: "blocker",
    impactPill: "known_issue"
  },
  {
    id: "breaking",
    title: "Breaking changes",
    mode: "by-release",
    searchFilter: { impactKind: "breaking_change" },
    countFrom: (c) => c.byImpact.breaking_change ?? 0,
    defaultOpen: true,
    emptyMessage: "No breaking changes in this range.",
    variant: "blocker",
    impactPill: "breaking_change"
  },
  {
    id: "api",
    title: "API changes",
    mode: "by-release",
    searchFilter: { impactKind: "api_change" },
    countFrom: (c) => c.byImpact.api_change ?? 0,
    defaultOpen: true,
    emptyMessage: "No API changes in this range.",
    variant: "review",
    impactPill: "api_change"
  },
  {
    id: "known",
    title: "Other known issues",
    mode: "by-issue",
    searchFilter: { impactKind: "known_issue" },
    postFilter: (r) => r.risk_level !== "blocker",
    countFrom: (c) => Math.max((c.byImpact.known_issue ?? 0) - c.blockerKnownIssues, 0),
    defaultOpen: false,
    emptyMessage: "No outstanding known issues.",
    variant: "caution",
    impactPill: "known_issue"
  },
  {
    id: "security",
    title: "Security & install risk",
    mode: "by-release",
    searchFilter: { impactKind: ["security_related_fix", "install_risk"] },
    countFrom: (c) => (c.byImpact.security_related_fix ?? 0) + (c.byImpact.install_risk ?? 0),
    defaultOpen: false,
    emptyMessage: "No security or install-impact notes.",
    variant: "caution",
    impactPill: "security_related_fix"
  },
  {
    id: "package",
    title: "Package changes",
    mode: "by-package",
    searchFilter: { impactKind: "package_change" },
    countFrom: (c) => c.byImpact.package_change ?? 0,
    defaultOpen: false,
    emptyMessage: "No package updates.",
    variant: "review",
    impactPill: "package_change"
  },
  {
    id: "feature",
    title: "New features",
    mode: "by-release",
    searchFilter: { impactKind: "feature" },
    countFrom: (c) => c.byImpact.feature ?? 0,
    defaultOpen: false,
    emptyMessage: "No new features.",
    variant: "info",
    impactPill: "feature"
  },
  {
    id: "improvement",
    title: "Improvements",
    mode: "by-release",
    searchFilter: { impactKind: "improvement" },
    countFrom: (c) => c.byImpact.improvement ?? 0,
    defaultOpen: false,
    emptyMessage: "No improvements.",
    variant: "info",
    impactPill: "improvement"
  },
  {
    id: "fix",
    title: "Fixes",
    mode: "by-release",
    searchFilter: { impactKind: "fix" },
    countFrom: (c) => c.byImpact.fix ?? 0,
    defaultOpen: false,
    emptyMessage: "No fixes.",
    variant: "success",
    impactPill: "fix"
  },
  {
    id: "change",
    title: "Other changes",
    mode: "by-release",
    searchFilter: { impactKind: "change" },
    countFrom: (c) => c.byImpact.change ?? 0,
    defaultOpen: false,
    emptyMessage: "No miscellaneous changes.",
    variant: "info",
    impactPill: "change"
  }
];

export default async function ComparePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = toUrlSearchParams(await searchParams);
  const [userVersion, allReleases, streamFilter, userPackages] = await Promise.all([
    getUserVersion(),
    safeListReleases(),
    getStreamFilter(),
    getUserPackages()
  ]);
  const userPackagesSet = new Set(userPackages);
  const fromVersion = (params.get("from") ?? userVersion ?? "").trim();
  const toVersion = (params.get("to") ?? "").trim();
  const platform = (params.get("platform") ?? "").trim();
  const expandList = (params.get("expand") ?? "").split(",").filter(Boolean);
  const expandedOverrides = new Set(expandList);
  const topicList = parseLaneIds(params.get("topics") ?? "");
  const topicFilter = new Set<LaneId>(topicList);
  const hasTopicFilter = topicFilter.size > 0;

  // The picker dropdowns honor the global stream filter, but the currently
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
      <ComparePicker fromVersion={fromVersion} toVersion={toVersion} releases={pickerReleases}>
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
      <ComparePicker fromVersion={fromVersion} toVersion={toVersion} releases={pickerReleases}>
        <div className="empty-state">
          <h2>Versions not found</h2>
          <p>One of these versions isn’t in the index yet. Try selecting from the dropdowns.</p>
        </div>
      </ComparePicker>
    );
  }

  if (range.versions.length === 0) {
    return (
      <ComparePicker fromVersion={fromVersion} toVersion={toVersion} releases={pickerReleases}>
        <div className="empty-state">
          {streamFilter.length === 0 ? (
            <>
              <h2>No streams selected</h2>
              <p>Re-check at least one stream (LTS / Update / Beta / Alpha) in the left sidebar to see what changed.</p>
            </>
          ) : (
            <>
              <h2>No releases in range</h2>
              <p>
                Nothing falls between <code>{fromVersion}</code> and <code>{toVersion}</code> with the streams you have
                checked in the sidebar ({streamFilter.join(" + ")}). Try widening your selection.
              </p>
            </>
          )}
        </div>
      </ComparePicker>
    );
  }

  // Run the cheap aggregate and every lane's row query in parallel.
  // by-issue and by-package lanes pull a generous slice so dedupe still
  // produces a useful set; by-release lanes only need ~2x the visible rows.
  const [counts, ...laneRowsArr] = await Promise.all([
    diffRangeCounts(range.versions, platform || undefined),
    ...LANES.map((lane) =>
      searchReleaseNotesInRange(
        range.versions,
        {
          ...lane.searchFilter,
          ...(platform ? { platform } : {})
        },
        lane.mode === "by-release" ? FETCH_FOR_BY_RELEASE : FETCH_FOR_DEDUP
      ) as Promise<ReleaseNoteRow[]>
    )
  ]);

  const lanes = LANES.map((def, i) => {
    const fetched = laneRowsArr[i] ?? [];
    let filtered = def.postFilter ? fetched.filter(def.postFilter) : fetched;
    // Manifest-aware filtering on the package lane only. Other lanes
    // intentionally stay unfiltered — a breaking-change in a package the
    // user doesn't depend on directly can still affect a transitive
    // dependency, so we don't want to silently hide those.
    if (def.id === "package" && userPackagesSet.size > 0) {
      filtered = filtered.filter((row) =>
        (row.package_names ?? []).some((p) => userPackagesSet.has(p))
      );
    }
    return {
      def,
      fetchedRows: filtered,
      totalCount: def.countFrom(counts)
    };
  });
  const visibleLanes = hasTopicFilter
    ? lanes.filter((lane) => topicFilter.has(lane.def.id))
    : lanes;

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
      <ComparePicker fromVersion={fromVersion} toVersion={toVersion} releases={pickerReleases} />

      <section className="page-header">
        <div className="page-header__title-row">
          <h1>
            {range.reversed ? "Downgrading from " : "Comparing "}
            <VersionPill version={fromVersion} stream={lookupStream(allReleases, fromVersion)} />
            {" → "}
            <VersionPill version={toVersion} stream={lookupStream(allReleases, toVersion)} />
          </h1>
        </div>
        <p className="muted">
          Spans <strong>{range.versions.length}</strong>{" "}
          {range.versions.length === 1 ? "release" : "releases"} ·{" "}
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
              Scoped to {range.includedStreams.join(" + ")} on{" "}
              {range.includedMinorLines.length === 1
                ? range.includedMinorLines[0]
                : `${range.includedMinorLines[0]}–${range.includedMinorLines[range.includedMinorLines.length - 1]}`}{" "}
              from your sidebar streams. Toggle streams in the left nav to broaden or narrow the diff.
            </>
          ) : (
            <>No streams selected in the sidebar — re-check at least one to see results.</>
          )}
        </p>
      </section>

      <CompareFacts counts={counts} />

      <section className="summary-strip" id="compare-categories">
        <div className="summary-strip__head">
          <span className="summary-strip__label">Categories</span>
          {hasTopicFilter ? (
            <a
              className="summary-strip__clear"
              href={compareTopicsHref({
                fromVersion,
                toVersion,
                platform,
                expanded: expandedOverrides,
                topicFilter,
                laneId: null
              })}
            >
              Show all topics
            </a>
          ) : (
            <span className="summary-strip__hint">Toggle or filter lanes from here</span>
          )}
        </div>
        <div className="summary-strip__grid">
          {lanes
            .filter((l) => l.totalCount > 0)
            .map((l) => {
              const open = isLaneOpen(l.def, expandedOverrides);
              const topicActive = topicFilter.has(l.def.id);
              return (
                <div
                  key={l.def.id}
                  className={`summary-item summary-item--${l.def.variant}${
                    topicActive ? " summary-item--active" : ""
                  }`}
                >
                  <a
                    href={compareLaneToggleHref({
                      fromVersion,
                      toVersion,
                      platform,
                      expanded: expandedOverrides,
                      topicFilter,
                      lane: l.def
                    })}
                    className="summary-item__toggle"
                    aria-controls={`lane-${l.def.id}`}
                    aria-expanded={open}
                  >
                    <Icon name={open ? "chevron-down" : "chevron-right"} size={14} />
                    <span className="summary-item__label">{l.def.title}</span>
                    <strong className="summary-item__count tabnums">
                      {l.totalCount.toLocaleString()}
                    </strong>
                  </a>
                  <a
                    href={compareTopicsHref({
                      fromVersion,
                      toVersion,
                      platform,
                      expanded: expandedOverrides,
                      topicFilter,
                      laneId: l.def.id
                    })}
                    className="summary-item__filter"
                    aria-label={
                      topicActive && topicFilter.size === 1
                        ? "Show all topics"
                        : `Show only ${l.def.title}`
                    }
                  >
                    {topicActive && topicFilter.size === 1 ? "All" : "Only"}
                  </a>
                </div>
              );
            })}
        </div>
      </section>

      <div className="compare-layout">
        <div>
          {visibleLanes.map((l) => (
            <Lane
              key={l.def.id}
              def={l.def}
              fetchedRows={l.fetchedRows}
              totalCount={l.totalCount}
              expanded={expandedOverrides}
              streamByVersion={streamByVersion}
              packageBoundaries={packageBoundaries}
            />
          ))}
        </div>

        <aside className="compare-meta">
          <h4>Filters</h4>
          <form method="get" action="/compare">
            <input type="hidden" name="from" value={fromVersion} />
            <input type="hidden" name="to" value={toVersion} />
            <label style={{ display: "block", marginBottom: 8 }}>
              <span
                className="muted"
                style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}
              >
                Platform
              </span>
              <select name="platform" defaultValue={platform}>
                <option value="">All platforms</option>
                {counts.topPlatforms.map(({ platform: name, count }) => (
                  <option value={name} key={name}>
                    {name} ({count.toLocaleString()})
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn--primary btn--small" style={{ width: "100%", marginTop: 8 }}>
              Apply
            </button>
          </form>

          <h4 style={{ marginTop: 16 }}>Top areas</h4>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {counts.topAreas.map(({ area, count }) => (
              <li
                key={area}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: "var(--text-secondary)"
                }}
              >
                <span>{area}</span>
                <span className="muted tabnums">{count}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}

function Lane({
  def,
  fetchedRows,
  totalCount,
  expanded,
  streamByVersion,
  packageBoundaries
}: {
  def: LaneDef;
  fetchedRows: ReleaseNoteRow[];
  totalCount: number;
  expanded: Set<string>;
  streamByVersion: Map<string, string | null>;
  packageBoundaries: Map<string, PackageBoundary>;
}) {
  const isOpen = isLaneOpen(def, expanded);
  return (
    <section className="lane" id={`lane-${def.id}`} data-collapsed={isOpen ? undefined : "true"}>
      <header className="lane__header">
        <ImpactPill kind={def.impactPill} />
        <h3>{def.title}</h3>
        <div className="lane__header-meta">
          <span className="chip chip--count tabnums">{totalCount.toLocaleString()}</span>
        </div>
      </header>
      <div className="lane__body">
        {totalCount === 0 ? (
          <div className="lane__empty">
            <Icon name="check" size={16} />
            {def.emptyMessage}
          </div>
        ) : def.mode === "by-issue" ? (
          <ByIssueLaneBody
            rows={fetchedRows}
            totalRowCount={totalCount}
            streamByVersion={streamByVersion}
          />
        ) : def.mode === "by-package" ? (
          <ByPackageLaneBody
            rows={fetchedRows}
            totalRowCount={totalCount}
            boundaries={packageBoundaries}
          />
        ) : (
          <ByReleaseLaneBody
            rows={fetchedRows}
            totalRowCount={totalCount}
            streamByVersion={streamByVersion}
          />
        )}
      </div>
    </section>
  );
}

// ─── by-release ────────────────────────────────────────────────

function ByReleaseLaneBody({
  rows,
  totalRowCount,
  streamByVersion
}: {
  rows: ReleaseNoteRow[];
  totalRowCount: number;
  streamByVersion: Map<string, string | null>;
}) {
  // Dedup intra-release repeats (Unity sometimes lists the same UUM
  // twice in one release-notes page) before slicing — otherwise the
  // duplicates can crowd the visible window and push real entries off.
  const deduped = dedupWithinReleases(rows);
  const visible = deduped.slice(0, ROWS_PER_LANE);
  const groups = groupByVersion(visible);
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
              <span className="muted tabnums lane__group-date">{formatDate(group.releaseDate)}</span>
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
      {totalRowCount > visible.length ? (
        <div className="lane__footer">
          Showing first <strong>{visible.length}</strong> of{" "}
          <strong className="tabnums">{totalRowCount.toLocaleString()}</strong>
        </div>
      ) : null}
    </>
  );
}

// ─── by-issue (dedupe by issue id / body) ──────────────────────

function ByIssueLaneBody({
  rows,
  totalRowCount,
  streamByVersion
}: {
  rows: ReleaseNoteRow[];
  totalRowCount: number;
  streamByVersion: Map<string, string | null>;
}) {
  const deduped = dedupeByIssue(rows);
  const visible = deduped.slice(0, ROWS_PER_LANE);
  return (
    <>
      {visible.map((item) => (
        <DedupedIssueRow key={item.key} item={item} streamByVersion={streamByVersion} />
      ))}
      <div className="lane__footer">
        {deduped.length === visible.length ? (
          <>
            <strong>{deduped.length.toLocaleString()}</strong> unique{" "}
            {deduped.length === 1 ? "issue" : "issues"} across{" "}
            <strong className="tabnums">{totalRowCount.toLocaleString()}</strong> mentions.
          </>
        ) : (
          <>
            Showing first <strong>{visible.length}</strong> of{" "}
            <strong>{deduped.length.toLocaleString()}</strong> unique issues (
            <span className="tabnums">{totalRowCount.toLocaleString()}</span> total mentions).
          </>
        )}
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
  boundaries
}: {
  rows: ReleaseNoteRow[];
  totalRowCount: number;
  boundaries: Map<string, PackageBoundary>;
}) {
  const aggregated = aggregateByPackage(rows);
  const visible = aggregated.slice(0, ROWS_PER_LANE);
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
      <div className="lane__footer">
        {aggregated.length === visible.length ? (
          <>
            <strong>{aggregated.length.toLocaleString()}</strong>{" "}
            {aggregated.length === 1 ? "package" : "packages"} touched across{" "}
            <strong className="tabnums">{totalRowCount.toLocaleString()}</strong> mentions.
          </>
        ) : (
          <>
            Showing top <strong>{visible.length}</strong> of{" "}
            <strong>{aggregated.length.toLocaleString()}</strong> packages.
          </>
        )}
      </div>
    </>
  );
}

function NoteRow({ row }: { row: ReleaseNoteRow }) {
  const cleanedBody = cleanReleaseNoteText(row.body ?? "");
  const issueLinks = normalizeIssueLinks(row.issue_ids ?? [], row.issue_links_json);

  return (
    <article className="row" aria-label={`${row.section} note in ${row.version}`}>
      <span className="row__lead">
        {row.area ? <span>{row.area}</span> : <span className="muted">{row.section}</span>}
      </span>
      <div className="row__body">
        <div className="row__title row__title--wrap" title={cleanedBody}>
          {cleanedBody}
        </div>
        <div className="row__pills">
          <RiskBadge level={row.risk_level} />
          {(row.package_names ?? []).slice(0, 2).map((pkg) => (
            <PackagePill name={pkg} key={pkg} />
          ))}
          {(row.platforms ?? []).slice(0, 4).map((plat) => (
            <PlatformPill platform={plat} key={plat} />
          ))}
          {issueLinks.slice(0, 3).map((issue) => (
            <IssuePill id={issue.id} url={issue.url} key={issue.id} />
          ))}
        </div>
      </div>
    </article>
  );
}

function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function compareLaneToggleHref(input: {
  fromVersion: string;
  toVersion: string;
  platform: string;
  expanded: Set<string>;
  topicFilter: Set<LaneId>;
  lane: LaneDef;
}) {
  const expanded = new Set(input.expanded);
  if (isLaneOpen(input.lane, expanded)) {
    expanded.delete(input.lane.id);
    if (input.lane.defaultOpen) expanded.add(`!${input.lane.id}`);
  } else {
    expanded.delete(`!${input.lane.id}`);
    expanded.add(input.lane.id);
  }

  return compareUrl({
    fromVersion: input.fromVersion,
    toVersion: input.toVersion,
    platform: input.platform,
    expanded,
    topicFilter: input.topicFilter,
    hash: `lane-${input.lane.id}`
  });
}

function compareTopicsHref(input: {
  fromVersion: string;
  toVersion: string;
  platform: string;
  expanded: Set<string>;
  topicFilter: Set<LaneId>;
  laneId: LaneId | null;
}) {
  const expanded = new Set(input.expanded);
  let topicFilter = new Set<LaneId>();
  let hash = "compare-categories";

  if (input.laneId && !(input.topicFilter.size === 1 && input.topicFilter.has(input.laneId))) {
    topicFilter = new Set([input.laneId]);
    expanded.delete(`!${input.laneId}`);
    expanded.add(input.laneId);
    hash = `lane-${input.laneId}`;
  }

  return compareUrl({
    fromVersion: input.fromVersion,
    toVersion: input.toVersion,
    platform: input.platform,
    expanded,
    topicFilter,
    hash
  });
}

function compareUrl(input: {
  fromVersion: string;
  toVersion: string;
  platform: string;
  expanded: Set<string>;
  topicFilter: Set<LaneId>;
  hash: string;
}) {
  const params = new URLSearchParams();
  params.set("from", input.fromVersion);
  params.set("to", input.toVersion);
  if (input.platform) params.set("platform", input.platform);
  if (input.expanded.size > 0) params.set("expand", Array.from(input.expanded).join(","));
  if (input.topicFilter.size > 0) params.set("topics", Array.from(input.topicFilter).join(","));
  return `/compare?${params.toString()}#${input.hash}`;
}

function isLaneOpen(def: LaneDef, expanded: Set<string>) {
  return expanded.has(def.id) || (def.defaultOpen && !expanded.has(`!${def.id}`));
}

function parseLaneIds(value: string) {
  const ids = new Set(LANES.map((lane) => lane.id));
  return value
    .split(",")
    .filter((id): id is LaneId => ids.has(id as LaneId));
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

function ComparePicker({
  fromVersion,
  toVersion,
  releases,
  children
}: {
  fromVersion: string;
  toVersion: string;
  releases: { version: string; stream: string | null; release_date: string | null }[];
  children?: React.ReactNode;
}) {
  // A single shared <datalist> drives substring autocomplete on both inputs.
  // Native <select> with 200 versions has no search at all; <input list>
  // gives the user proper type-to-filter without a JS combobox dependency.
  const datalistId = "compare-picker-versions";
  const swapHref =
    fromVersion && toVersion
      ? `/compare?from=${encodeURIComponent(toVersion)}&to=${encodeURIComponent(fromVersion)}`
      : "";

  return (
    <>
      <form className="compare-picker" method="get" action="/compare">
        <datalist id={datalistId}>
          {releases.map((r) => (
            <option key={r.version} value={r.version}>
              {r.stream ? `${r.stream} · ${r.release_date ? formatDate(r.release_date) : ""}` : ""}
            </option>
          ))}
        </datalist>

        <label>
          <span>From</span>
          <input
            type="text"
            name="from"
            list={datalistId}
            defaultValue={fromVersion}
            placeholder="Type a version…"
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        {swapHref ? (
          <a className="compare-picker__swap" href={swapHref} aria-label="Swap from and to" title="Swap from and to">
            <Icon name="arrows-left-right" size={16} />
          </a>
        ) : (
          <button type="button" className="compare-picker__swap" aria-label="Swap from and to" disabled>
            <Icon name="arrows-left-right" size={16} />
          </button>
        )}

        <label>
          <span>To</span>
          <input
            type="text"
            name="to"
            list={datalistId}
            defaultValue={toVersion}
            placeholder="Type a version…"
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <button type="submit" className="btn btn--primary compare-picker__go">
          <Icon name="git-compare" size={14} />
          Compare
        </button>
      </form>
      {children}
    </>
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
