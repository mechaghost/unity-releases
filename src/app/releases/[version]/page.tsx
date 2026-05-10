import { cookies } from "next/headers";
import {
  getIssueStatuses,
  getRelease,
  getReleaseRangeFacets,
  searchReleaseNotes
} from "@/lib/db/repositories";
import type { IssueStatus } from "@/lib/issue-status";
import { streamLabel } from "@/lib/stream-labels";
import { formatReleaseDate } from "@/lib/format-date";
import { getUserPackages } from "@/lib/user-packages";
import { LANE_CATALOG, LANE_IDS, type LaneId } from "@/lib/lane-catalog";
import {
  filtersToSearchFilters,
  parseFiltersFromParams,
  parsePersonaCookie,
  parseSavedPresetsCookie,
  personaCookieName,
  savedPresetsCookieName
} from "@/lib/filters";
import { VersionPill } from "../../_components/VersionPill";
import { ExternalLink } from "../../_components/ExternalLink";
import { Icon } from "../../_components/Icon";
import { NoteRow, type NoteRowData } from "../../_components/NoteRow";
import { LaneCollapseProvider, LaneShell } from "../../_components/ReviewLanes";
import { FilterBar } from "../../_components/FilterBar";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ version: string }>;
}) {
  const { version } = await params;
  return {
    title: `Unity ${version} release notes`,
    description: `Lane-bucketed release notes for Unity ${version} - known blockers, breaking changes, API changes, security fixes, package bumps, and other notable changes parsed from Unity's official release notes.`,
    alternates: { canonical: `/releases/${encodeURIComponent(version)}` }
  };
}

type ReleaseNoteRow = NoteRowData & {
  version: string;
  source_url: string;
  source_order: number;
};

type LaneDef = (typeof LANE_CATALOG)[LaneId] & {
  filter: (row: ReleaseNoteRow) => boolean;
};

/**
 * Filters mirror the impact_kind / risk_level columns from
 * `release_note_items` so the per-release view buckets every parsed
 * note into the same lanes the diff view uses on the server side.
 */
const LANE_FILTERS: Record<LaneId, (r: ReleaseNoteRow) => boolean> = {
  blockers: (r) => r.impact_kind === "known_issue" && r.risk_level === "blocker",
  known: (r) => r.impact_kind === "known_issue" && r.risk_level !== "blocker",
  breaking: (r) => r.impact_kind === "breaking_change",
  api: (r) => r.impact_kind === "api_change",
  security: (r) =>
    r.impact_kind === "security_related_fix" || r.impact_kind === "install_risk",
  package: (r) => r.impact_kind === "package_change",
  feature: (r) => r.impact_kind === "feature",
  improvement: (r) => r.impact_kind === "improvement",
  fix: (r) => r.impact_kind === "fix",
  change: (r) => r.impact_kind === "change",
  docs: (r) => r.impact_kind === "documentation"
};

const LANES: LaneDef[] = LANE_IDS.map((id) => ({
  ...LANE_CATALOG[id],
  filter: LANE_FILTERS[id]
}));

export default async function ReleasePage({
  params,
  searchParams
}: {
  params: Promise<{ version: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { version } = await params;
  const decoded = decodeURIComponent(version);
  const query = await searchParams;
  const urlParams = toUrlSearchParams(query);

  const cookieJar = await cookies();
  const presetCookie = parsePersonaCookie(cookieJar.get(personaCookieName("release"))?.value);
  const savedPresets = parseSavedPresetsCookie(
    cookieJar.get(savedPresetsCookieName("release"))?.value
  );
  const filterState = parseFiltersFromParams(urlParams, presetCookie ?? "balanced");
  const userPackages = await getUserPackages();

  // Resolve the release first so we can pass its date as the regressions
  // boundary. Then build the search filter and fetch notes.
  const release = await safeRelease(decoded);
  const userSearchFilters = filtersToSearchFilters(
    filterState,
    userPackages,
    release?.release_date ?? null
  );
  const [allRows, facets] = await Promise.all([
    safeNotes(decoded, userSearchFilters),
    getReleaseRangeFacets([decoded])
  ]);
  const rows = allRows as ReleaseNoteRow[];

  // If the user picked specific lanes in the drawer, hide the others entirely.
  const laneIdSelection =
    filterState.lanes.length > 0 ? new Set(filterState.lanes) : null;
  const visibleLaneDefs = laneIdSelection
    ? LANES.filter((l) => laneIdSelection.has(l.id))
    : LANES;
  const lanes = visibleLaneDefs.map((def) => ({
    def,
    rows: rows.filter(def.filter)
  }));

  const issueIds = unique(rows.flatMap((r) => r.issue_ids ?? []));
  const issueStatuses = await safeIssueStatuses(issueIds);

  return (
    <>
      <section className="page-header">
        <div className="page-header__title-row">
          <h1>
            <VersionPill version={decoded} stream={release?.stream} href={null} />
          </h1>
        </div>
        {release ? (
          <p>
            {streamLabel(release.stream)}
            {release.release_date ? <> · Released {formatReleaseDate(release.release_date)}</> : null}
            {release.changeset ? <> · Changeset {release.changeset}</> : null}
            {" · "}
            <strong className="tabnums">{rows.length.toLocaleString()}</strong> release notes
          </p>
        ) : (
          <p className="muted">Release not yet indexed.</p>
        )}
        <div className="cluster page-meta-row">
          {release ? (
            <>
              <ExternalLink href={release.release_page_url}>Unity release page</ExternalLink>
              {release.release_notes_url ? (
                <ExternalLink href={release.release_notes_url}>Release notes (markdown)</ExternalLink>
              ) : null}
              {release.unity_hub_deep_link ? (
                <a className="btn btn--primary btn--small hide-mobile" href={release.unity_hub_deep_link}>
                  <Icon name="package" size={14} /> Open in Unity Hub
                </a>
              ) : null}
            </>
          ) : null}
        </div>
      </section>

      <FilterBar
        filters={filterState}
        facets={facets}
        manifestPackages={userPackages}
        savedPresets={savedPresets}
        preservedParams={{}}
        basePath={`/releases/${encodeURIComponent(decoded)}`}
        view="release"
      />

      {(() => {
        const lanesWithResults = lanes.filter(({ rows }) => rows.length > 0);
        const initialCollapsed = lanesWithResults
          .filter(({ def }) => !def.defaultOpen)
          .map(({ def }) => def.id);

        return (
          <LaneCollapseProvider initialCollapsed={initialCollapsed}>
            <div>
              {lanesWithResults.map(({ def, rows }) => (
                <ReleaseLane key={def.id} def={def} rows={rows} issueStatuses={issueStatuses} />
              ))}
            </div>
          </LaneCollapseProvider>
        );
      })()}
    </>
  );
}

function ReleaseLane({
  def,
  rows,
  issueStatuses
}: {
  def: LaneDef;
  rows: ReleaseNoteRow[];
  issueStatuses: Map<string, IssueStatus>;
}) {
  const visible = rows.slice(0, 200);
  return (
    <LaneShell
      id={def.id}
      variant={def.variant}
      title={def.title}
      count={rows.length}
    >
      {rows.length === 0 ? (
        <div className="lane__empty">
          <Icon name="check" size={16} />
          None.
        </div>
      ) : (
        visible.map((row) => (
          <NoteRow key={row.id} row={row} showImpactPill issueStatuses={issueStatuses} />
        ))
      )}
      {rows.length > visible.length ? (
        <div className="lane__footer">
          Showing first <strong>{visible.length}</strong> of{" "}
          <strong className="tabnums">{rows.length.toLocaleString()}</strong>
        </div>
      ) : null}
    </LaneShell>
  );
}

async function safeRelease(version: string) {
  try {
    return await getRelease(version);
  } catch {
    return null;
  }
}

async function safeIssueStatuses(ids: string[]): Promise<Map<string, IssueStatus>> {
  if (ids.length === 0) return new Map();
  try {
    return await getIssueStatuses(ids);
  } catch {
    return new Map();
  }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

async function safeNotes(
  version: string,
  extraFilters: ReturnType<typeof filtersToSearchFilters> = {}
) {
  try {
    return await searchReleaseNotes({
      version,
      order: "source",
      limit: 5000,
      ...extraFilters
    });
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
