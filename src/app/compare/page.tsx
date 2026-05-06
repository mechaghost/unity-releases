import { resolveDiffRange, searchReleaseNotesInRange, listReleases } from "@/lib/db/repositories";
import { getUserVersion } from "@/lib/user-version";
import { cleanReleaseNoteText, normalizeIssueLinks } from "@/lib/release-notes/format";
import { IssuePill } from "../_components/IssuePill";
import { PackagePill } from "../_components/PackagePill";
import { PlatformPill } from "../_components/PlatformPill";
import { ImpactPill, impactLabel } from "../_components/ImpactPill";
import { RiskBadge } from "../_components/RiskBadge";
import { VersionPill } from "../_components/VersionPill";
import { Icon } from "../_components/Icon";

export const dynamic = "force-dynamic";

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
  release_date: string | null;
};

type LaneDef = {
  id: string;
  title: string;
  filter: (row: ReleaseNoteRow) => boolean;
  defaultOpen: boolean;
  emptyMessage: string;
  variant: "blocker" | "caution" | "review" | "info" | "success";
};

const LANES: LaneDef[] = [
  {
    id: "blockers",
    title: "Active known blockers",
    filter: (r) => r.impact_kind === "known_issue" && r.risk_level === "blocker",
    defaultOpen: true,
    emptyMessage: "No known blockers in this range.",
    variant: "blocker"
  },
  {
    id: "breaking",
    title: "Breaking changes",
    filter: (r) => r.impact_kind === "breaking_change",
    defaultOpen: true,
    emptyMessage: "No breaking changes in this range.",
    variant: "blocker"
  },
  {
    id: "api",
    title: "API changes",
    filter: (r) => r.impact_kind === "api_change",
    defaultOpen: true,
    emptyMessage: "No API changes in this range.",
    variant: "review"
  },
  {
    id: "known",
    title: "Other known issues",
    filter: (r) => r.impact_kind === "known_issue" && r.risk_level !== "blocker",
    defaultOpen: false,
    emptyMessage: "No outstanding known issues.",
    variant: "caution"
  },
  {
    id: "security",
    title: "Security & install risk",
    filter: (r) => r.impact_kind === "security_related_fix" || r.impact_kind === "install_risk",
    defaultOpen: false,
    emptyMessage: "No security or install-impact notes.",
    variant: "caution"
  },
  {
    id: "package",
    title: "Package changes",
    filter: (r) => r.impact_kind === "package_change",
    defaultOpen: false,
    emptyMessage: "No package updates.",
    variant: "review"
  },
  {
    id: "feature",
    title: "New features",
    filter: (r) => r.impact_kind === "feature",
    defaultOpen: false,
    emptyMessage: "No new features.",
    variant: "info"
  },
  {
    id: "improvement",
    title: "Improvements",
    filter: (r) => r.impact_kind === "improvement",
    defaultOpen: false,
    emptyMessage: "No improvements.",
    variant: "info"
  },
  {
    id: "fix",
    title: "Fixes",
    filter: (r) => r.impact_kind === "fix",
    defaultOpen: false,
    emptyMessage: "No fixes.",
    variant: "success"
  },
  {
    id: "change",
    title: "Other changes",
    filter: (r) => r.impact_kind === "change",
    defaultOpen: false,
    emptyMessage: "No miscellaneous changes.",
    variant: "info"
  }
];

export default async function ComparePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = toUrlSearchParams(await searchParams);
  const userVersion = await getUserVersion();
  // If `from` isn't in the URL, default to the user's chosen Unity version.
  const fromVersion = (params.get("from") ?? userVersion ?? "").trim();
  const toVersion = (params.get("to") ?? "").trim();
  const platform = (params.get("platform") ?? "").trim();
  const expandList = (params.get("expand") ?? "").split(",").filter(Boolean);
  const expandedOverrides = new Set(expandList);

  const allReleases = await safeListReleases();

  if (!fromVersion || !toVersion) {
    return (
      <ComparePicker
        fromVersion={fromVersion}
        toVersion={toVersion}
        releases={allReleases}
      >
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
      <ComparePicker
        fromVersion={fromVersion}
        toVersion={toVersion}
        releases={allReleases}
      >
        <div className="empty-state">
          <h2>Versions not found</h2>
          <p>
            One of these versions isn’t in the index yet. Try selecting from the dropdowns.
          </p>
        </div>
      </ComparePicker>
    );
  }

  if (range.versions.length === 0) {
    return (
      <ComparePicker
        fromVersion={fromVersion}
        toVersion={toVersion}
        releases={allReleases}
      >
        <div className="empty-state">
          <h2>Same version</h2>
          <p>
            <code>{fromVersion}</code> and <code>{toVersion}</code> are identical or have the same release date.
          </p>
        </div>
      </ComparePicker>
    );
  }

  const filters = platform ? { platform } : {};
  const rows = (await searchReleaseNotesInRange(range.versions, filters, 12000)) as ReleaseNoteRow[];

  const lanes = LANES.map((def) => ({
    def,
    rows: rows.filter(def.filter)
  }));

  const totalNotes = rows.length;
  const platformCounts = countPlatforms(rows);
  const areaCounts = countAreas(rows);

  return (
    <>
      <ComparePicker fromVersion={fromVersion} toVersion={toVersion} releases={allReleases} />

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
          <strong className="tabnums">{totalNotes.toLocaleString()}</strong> release notes
          {platform ? (
            <>
              {" · platform "}<code>{platform}</code>
            </>
          ) : null}
        </p>
      </section>

      <section className="summary-strip">
        <span className="summary-strip__label">Summary</span>
        {lanes
          .filter(({ rows }) => rows.length > 0)
          .map(({ def, rows }) => (
            <a
              key={def.id}
              href={`#lane-${def.id}`}
              className={`summary-chip summary-chip--${def.variant}`}
            >
              <strong className="tabnums">{rows.length}</strong>{" "}
              {def.title.toLowerCase()}
            </a>
          ))}
      </section>

      <div className="compare-layout">
        <div>
          {lanes.map(({ def, rows }) => (
            <Lane key={def.id} def={def} rows={rows} expanded={expandedOverrides} />
          ))}
        </div>

        <aside className="compare-meta">
          <h4>Filters</h4>
          <form method="get" action="/compare">
            <input type="hidden" name="from" value={fromVersion} />
            <input type="hidden" name="to" value={toVersion} />
            <label style={{ display: "block", marginBottom: 8 }}>
              <span className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Platform
              </span>
              <select name="platform" defaultValue={platform}>
                <option value="">All platforms</option>
                {Array.from(platformCounts.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, count]) => (
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
            {Array.from(areaCounts.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([area, count]) => (
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
  rows,
  expanded
}: {
  def: LaneDef;
  rows: ReleaseNoteRow[];
  expanded: Set<string>;
}) {
  const isOpen = expanded.has(def.id) || (def.defaultOpen && !expanded.has(`!${def.id}`));
  const visible = rows.slice(0, 200);
  return (
    <section className="lane" id={`lane-${def.id}`} data-collapsed={isOpen ? undefined : "true"}>
      <header className="lane__header">
        <ImpactPill kind={inferImpactForLane(def.id)} />
        <h3>{def.title}</h3>
        <div className="lane__header-meta">
          <span className="chip chip--count tabnums">{rows.length.toLocaleString()}</span>
        </div>
      </header>
      <div className="lane__body">
        {rows.length === 0 ? (
          <div className="lane__empty">
            <Icon name="check" size={16} />
            {def.emptyMessage}
          </div>
        ) : (
          visible.map((row) => <NoteRow key={row.id} row={row} />)
        )}
      </div>
      {rows.length > visible.length ? (
        <div className="lane__footer">
          Showing first <strong>{visible.length}</strong> of{" "}
          <strong className="tabnums">{rows.length.toLocaleString()}</strong>
        </div>
      ) : null}
    </section>
  );
}

function NoteRow({ row }: { row: ReleaseNoteRow }) {
  const cleanedBody = cleanReleaseNoteText(row.body ?? "");
  const issueLinks = normalizeIssueLinks(row.issue_ids ?? [], row.issue_links_json);

  return (
    <article className="row" aria-label={`${row.section} note in ${row.version}`}>
      <span className="row__lead">
        <span className="tabnums">{row.version}</span>
        {row.area ? <span className="muted">{row.area}</span> : null}
      </span>
      <div className="row__body">
        <div className="row__title row__title--wrap" title={cleanedBody}>
          {cleanedBody}
        </div>
        <div className="row__pills">
          <ImpactPill kind={row.impact_kind} />
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

function inferImpactForLane(laneId: string): string {
  const map: Record<string, string> = {
    blockers: "known_issue",
    breaking: "breaking_change",
    api: "api_change",
    known: "known_issue",
    security: "security_related_fix",
    package: "package_change",
    feature: "feature",
    improvement: "improvement",
    fix: "fix",
    change: "change"
  };
  return map[laneId] ?? "change";
}

function lookupStream(
  releases: { version: string; stream: string | null }[],
  version: string
): string | null {
  return releases.find((r) => r.version === version)?.stream ?? null;
}

function countPlatforms(rows: ReleaseNoteRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const platform of row.platforms ?? []) {
      counts.set(platform, (counts.get(platform) ?? 0) + 1);
    }
  }
  return counts;
}

function countAreas(rows: ReleaseNoteRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.area) counts.set(row.area, (counts.get(row.area) ?? 0) + 1);
  }
  return counts;
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
