import {
  diffRangeCounts,
  listReleases,
  resolveDiffRange,
  searchReleaseNotesInRange
} from "@/lib/db/repositories";
import type { ReleaseNoteSearchFilters } from "@/lib/search";
import { getStreamFilter, streamMatches } from "@/lib/stream-filter";
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
  const [userVersion, allReleases, streamFilter] = await Promise.all([
    getUserVersion(),
    safeListReleases(),
    getStreamFilter()
  ]);
  const fromVersion = (params.get("from") ?? userVersion ?? "").trim();
  const toVersion = (params.get("to") ?? "").trim();
  const platform = (params.get("platform") ?? "").trim();
  const expandList = (params.get("expand") ?? "").split(",").filter(Boolean);
  const expandedOverrides = new Set(expandList);

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

  const range = await resolveDiffRange(fromVersion, toVersion);
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
          <h2>Same version</h2>
          <p>
            <code>{fromVersion}</code> and <code>{toVersion}</code> are identical or have the same release date.
          </p>
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
    const filtered = def.postFilter ? fetched.filter(def.postFilter) : fetched;
    return {
      def,
      fetchedRows: filtered,
      totalCount: def.countFrom(counts)
    };
  });

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
          Scoped to {range.includedStreams.join(" + ")} on{" "}
          {range.includedMinorLines.length === 1
            ? range.includedMinorLines[0]
            : `${range.includedMinorLines[0]}–${range.includedMinorLines[range.includedMinorLines.length - 1]}`}{" "}
          to keep the diff focused on the upgrade path. Cross-stream prereleases and unrelated minor lines are excluded.
        </p>
      </section>

      <section className="summary-strip">
        <span className="summary-strip__label">Summary</span>
        {lanes
          .filter((l) => l.totalCount > 0)
          .map((l) => (
            <a
              key={l.def.id}
              href={`#lane-${l.def.id}`}
              className={`summary-chip summary-chip--${l.def.variant}`}
            >
              <strong className="tabnums">{l.totalCount.toLocaleString()}</strong>{" "}
              {l.def.title.toLowerCase()}
            </a>
          ))}
      </section>

      <div className="compare-layout">
        <div>
          {lanes.map((l) => (
            <Lane
              key={l.def.id}
              def={l.def}
              fetchedRows={l.fetchedRows}
              totalCount={l.totalCount}
              expanded={expandedOverrides}
              streamByVersion={streamByVersion}
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
  streamByVersion
}: {
  def: LaneDef;
  fetchedRows: ReleaseNoteRow[];
  totalCount: number;
  expanded: Set<string>;
  streamByVersion: Map<string, string | null>;
}) {
  const isOpen = expanded.has(def.id) || (def.defaultOpen && !expanded.has(`!${def.id}`));
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
          <ByPackageLaneBody rows={fetchedRows} totalRowCount={totalCount} />
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
  const visible = rows.slice(0, ROWS_PER_LANE);
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

type DedupedIssue = {
  key: string;
  primary: ReleaseNoteRow;
  mentionCount: number;
  firstVersion: string;
  lastVersion: string;
  firstDate: string | Date | null;
  lastDate: string | Date | null;
};

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
  item: DedupedIssue;
  streamByVersion: Map<string, string | null>;
}) {
  const cleanedBody = cleanReleaseNoteText(item.primary.body ?? "");
  const issueLinks = normalizeIssueLinks(item.primary.issue_ids ?? [], item.primary.issue_links_json);
  return (
    <article className="row" aria-label={`${item.primary.section} note`}>
      <span className="row__lead">
        {item.primary.area ? (
          <span>{item.primary.area}</span>
        ) : (
          <span className="muted">{item.primary.section}</span>
        )}
      </span>
      <div className="row__body">
        <div className="row__title row__title--wrap" title={cleanedBody}>
          {cleanedBody}
        </div>
        <div className="row__pills">
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

function toTime(value: string | Date | null): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

function dedupeByIssue(rows: ReleaseNoteRow[]): DedupedIssue[] {
  const map = new Map<string, DedupedIssue>();
  for (const row of rows) {
    const id = (row.issue_ids ?? [])[0];
    const key = id ? `id:${id}` : `body:${shortHash(row.body ?? "")}`;
    const rowTime = toTime(row.release_date);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        primary: row,
        mentionCount: 1,
        firstVersion: row.version,
        lastVersion: row.version,
        firstDate: row.release_date,
        lastDate: row.release_date
      });
      continue;
    }
    existing.mentionCount += 1;
    if (rowTime && (!existing.firstDate || rowTime < toTime(existing.firstDate))) {
      existing.firstDate = row.release_date;
      existing.firstVersion = row.version;
    }
    if (rowTime && (!existing.lastDate || rowTime > toTime(existing.lastDate))) {
      existing.lastDate = row.release_date;
      existing.lastVersion = row.version;
      existing.primary = row; // most recent restatement is the canonical body
    }
  }
  // Sort: most recently last-seen first; within ties, more mentions first.
  return [...map.values()].sort((a, b) => {
    const cmp = toTime(b.lastDate) - toTime(a.lastDate);
    if (cmp !== 0) return cmp;
    return b.mentionCount - a.mentionCount;
  });
}

function shortHash(value: string): string {
  // Tiny non-cryptographic hash for deduping by body when no issue id exists.
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

// ─── by-package (aggregate by package_name) ────────────────────

type DedupedPackage = {
  packageName: string;
  mentionCount: number;
  firstVersion: string;
  lastVersion: string;
  firstDate: string | Date | null;
  lastDate: string | Date | null;
  sampleBody: string;
};

function ByPackageLaneBody({
  rows,
  totalRowCount
}: {
  rows: ReleaseNoteRow[];
  totalRowCount: number;
}) {
  const aggregated = aggregateByPackage(rows);
  const visible = aggregated.slice(0, ROWS_PER_LANE);
  return (
    <>
      {visible.map((item) => (
        <article className="row package-agg-row" key={item.packageName}>
          <span className="row__lead">
            <span className="muted">pkg</span>
          </span>
          <div className="row__body">
            <div className="row__title">
              <a className="link-internal--accent" href={`/packages/${encodeURIComponent(item.packageName)}`}>
                {item.packageName}
              </a>
            </div>
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
            {item.sampleBody ? (
              <div className="muted package-agg-row__sample" title={item.sampleBody}>
                {cleanReleaseNoteText(item.sampleBody)}
              </div>
            ) : null}
          </div>
        </article>
      ))}
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

function aggregateByPackage(rows: ReleaseNoteRow[]): DedupedPackage[] {
  const map = new Map<string, DedupedPackage>();
  for (const row of rows) {
    const names = row.package_names ?? [];
    if (names.length === 0) continue;
    const rowTime = toTime(row.release_date);
    for (const pkg of names) {
      const existing = map.get(pkg);
      if (!existing) {
        map.set(pkg, {
          packageName: pkg,
          mentionCount: 1,
          firstVersion: row.version,
          lastVersion: row.version,
          firstDate: row.release_date,
          lastDate: row.release_date,
          sampleBody: row.body ?? ""
        });
        continue;
      }
      existing.mentionCount += 1;
      if (rowTime && (!existing.firstDate || rowTime < toTime(existing.firstDate))) {
        existing.firstDate = row.release_date;
        existing.firstVersion = row.version;
      }
      if (rowTime && (!existing.lastDate || rowTime > toTime(existing.lastDate))) {
        existing.lastDate = row.release_date;
        existing.lastVersion = row.version;
        if (row.body) existing.sampleBody = row.body;
      }
    }
  }
  return [...map.values()].sort((a, b) => b.mentionCount - a.mentionCount);
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

type ReleaseGroup = { version: string; releaseDate: string | Date | null; rows: ReleaseNoteRow[] };

function groupByVersion(rows: ReleaseNoteRow[]): ReleaseGroup[] {
  const groups = new Map<string, ReleaseGroup>();
  for (const row of rows) {
    const existing = groups.get(row.version);
    if (existing) {
      existing.rows.push(row);
    } else {
      groups.set(row.version, {
        version: row.version,
        releaseDate: row.release_date,
        rows: [row]
      });
    }
  }
  return [...groups.values()];
}

function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
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
  return (
    <>
      <form className="compare-picker" method="get" action="/compare">
        <label>
          <span>From</span>
          <select name="from" defaultValue={fromVersion}>
            <option value="">Select…</option>
            {releases.map((r) => (
              <option key={r.version} value={r.version}>
                {r.version} {r.stream ? `· ${r.stream}` : ""}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="compare-picker__swap" aria-label="Swap from and to" disabled>
          <Icon name="arrows-left-right" size={16} />
        </button>
        <label>
          <span>To</span>
          <select name="to" defaultValue={toVersion}>
            <option value="">Select…</option>
            {releases.map((r) => (
              <option key={r.version} value={r.version}>
                {r.version} {r.stream ? `· ${r.stream}` : ""}
              </option>
            ))}
          </select>
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
