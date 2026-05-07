import { getRelease, searchReleaseNotes } from "@/lib/db/repositories";
import { streamLabel } from "@/lib/stream-labels";
import { formatReleaseDate } from "@/lib/format-date";
import { LANE_CATALOG, LANE_IDS, type LaneId } from "@/lib/lane-catalog";
import { VersionPill } from "../../_components/VersionPill";
import { ExternalLink } from "../../_components/ExternalLink";
import { Icon } from "../../_components/Icon";
import { NoteRow, type NoteRowData } from "../../_components/NoteRow";
import {
  LaneCollapseProvider,
  LaneShell,
  LaneSummaryPanel,
  type LaneSummary
} from "../../_components/ReviewLanes";

export const dynamic = "force-dynamic";

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
  const q = (query.q as string | undefined) ?? "";

  const release = await safeRelease(decoded);
  const rows = (await safeNotes(decoded, q)) as ReleaseNoteRow[];

  const lanes = LANES.map((def) => ({
    def,
    rows: rows.filter(def.filter)
  }));

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
        <div className="cluster" style={{ marginTop: 12 }}>
          {release ? (
            <>
              <ExternalLink href={release.release_page_url}>Unity release page</ExternalLink>
              {release.release_notes_url ? (
                <ExternalLink href={release.release_notes_url}>Release notes (markdown)</ExternalLink>
              ) : null}
              {release.unity_hub_deep_link ? (
                <a className="btn btn--primary btn--small" href={release.unity_hub_deep_link}>
                  <Icon name="package" size={14} /> Open in Unity Hub
                </a>
              ) : null}
            </>
          ) : null}
        </div>
      </section>

      <form className="filter-bar" method="get">
        <label className="field">
          <span>Search within {decoded}</span>
          <input
            type="search"
            name="q"
            placeholder="memory leak, URP, UUM-136929"
            defaultValue={q}
          />
        </label>
        <button type="submit" className="btn btn--primary btn--small">
          Search
        </button>
        {q ? (
          <a href={`/releases/${encodeURIComponent(decoded)}`} className="btn btn--tertiary btn--small">
            Clear
          </a>
        ) : null}
      </form>

      {(() => {
        const lanesWithResults = lanes.filter(({ rows }) => rows.length > 0);
        const laneSummaries: LaneSummary[] = lanesWithResults.map(({ def, rows }) => ({
          id: def.id,
          title: def.title,
          count: rows.length,
          variant: def.variant
        }));
        const initialCollapsed = lanesWithResults
          .filter(({ def }) => !def.defaultOpen)
          .map(({ def }) => def.id);

        return (
          <LaneCollapseProvider initialCollapsed={initialCollapsed}>
            <LaneSummaryPanel lanes={laneSummaries} />
            <div>
              {lanesWithResults.map(({ def, rows }) => (
                <ReleaseLane key={def.id} def={def} rows={rows} />
              ))}
            </div>
          </LaneCollapseProvider>
        );
      })()}
    </>
  );
}

function ReleaseLane({ def, rows }: { def: LaneDef; rows: ReleaseNoteRow[] }) {
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
        visible.map((row) => <NoteRow key={row.id} row={row} showImpactPill />)
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

async function safeNotes(version: string, q?: string) {
  try {
    return await searchReleaseNotes({ version, q: q || undefined, order: "source", limit: 5000 });
  } catch {
    return [];
  }
}
