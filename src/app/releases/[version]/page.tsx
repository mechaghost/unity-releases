import { getRelease, searchReleaseNotes } from "@/lib/db/repositories";
import { cleanReleaseNoteText, normalizeIssueLinks } from "@/lib/release-notes/format";
import { VersionPill } from "../../_components/VersionPill";
import { ImpactPill } from "../../_components/ImpactPill";
import { RiskBadge } from "../../_components/RiskBadge";
import { IssuePill } from "../../_components/IssuePill";
import { PackagePill } from "../../_components/PackagePill";
import { PlatformPill } from "../../_components/PlatformPill";
import { ExternalLink } from "../../_components/ExternalLink";
import { Icon } from "../../_components/Icon";

export const dynamic = "force-dynamic";

type ReleaseNoteRow = {
  id: number;
  version: string;
  section: string;
  area: string | null;
  platforms: string[];
  impact_kind: string;
  risk_level: string;
  body: string;
  issue_ids: string[];
  issue_links_json: unknown;
  package_names: string[];
  source_url: string;
  source_order: number;
};

type LaneDef = {
  id: string;
  title: string;
  filter: (row: ReleaseNoteRow) => boolean;
  defaultOpen: boolean;
};

const LANES: LaneDef[] = [
  {
    id: "blockers",
    title: "Active known blockers",
    filter: (r) => r.impact_kind === "known_issue" && r.risk_level === "blocker",
    defaultOpen: true
  },
  {
    id: "known",
    title: "Other known issues",
    filter: (r) => r.impact_kind === "known_issue" && r.risk_level !== "blocker",
    defaultOpen: true
  },
  {
    id: "breaking",
    title: "Breaking changes",
    filter: (r) => r.impact_kind === "breaking_change",
    defaultOpen: true
  },
  {
    id: "api",
    title: "API changes",
    filter: (r) => r.impact_kind === "api_change",
    defaultOpen: false
  },
  {
    id: "security",
    title: "Security & install impact",
    filter: (r) =>
      r.impact_kind === "security_related_fix" || r.impact_kind === "install_risk",
    defaultOpen: false
  },
  {
    id: "package",
    title: "Package updates",
    filter: (r) => r.impact_kind === "package_change",
    defaultOpen: false
  },
  {
    id: "feature",
    title: "Features",
    filter: (r) => r.impact_kind === "feature",
    defaultOpen: false
  },
  {
    id: "improvement",
    title: "Improvements",
    filter: (r) => r.impact_kind === "improvement",
    defaultOpen: false
  },
  {
    id: "fix",
    title: "Fixes",
    filter: (r) => r.impact_kind === "fix",
    defaultOpen: false
  },
  {
    id: "change",
    title: "Other changes",
    filter: (r) => r.impact_kind === "change",
    defaultOpen: false
  },
  {
    id: "docs",
    title: "Documentation",
    filter: (r) => r.impact_kind === "documentation",
    defaultOpen: false
  }
];

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
            {release.stream}
            {release.release_date ? <> · Released {formatDate(release.release_date)}</> : null}
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

      <section className="summary-strip">
        <span className="summary-strip__label">Lanes</span>
        {lanes
          .filter(({ rows }) => rows.length > 0)
          .map(({ def, rows }) => (
            <a
              key={def.id}
              href={`#lane-${def.id}`}
              className="summary-chip summary-chip--info"
            >
              <strong className="tabnums">{rows.length.toLocaleString()}</strong>{" "}
              {def.title.toLowerCase()}
            </a>
          ))}
      </section>

      <div>
        {lanes.map(({ def, rows }) => (
          <ReleaseLane key={def.id} def={def} rows={rows} />
        ))}
      </div>
    </>
  );
}

function ReleaseLane({ def, rows }: { def: LaneDef; rows: ReleaseNoteRow[] }) {
  const visible = rows.slice(0, 200);
  return (
    <section className="lane" id={`lane-${def.id}`} data-collapsed={def.defaultOpen ? undefined : "true"}>
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
            None.
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
    <article className="row">
      <span className="row__lead">
        {row.area ? <span className="muted">{row.area}</span> : <span className="muted">{row.section}</span>}
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

function inferImpactForLane(laneId: string): string {
  const map: Record<string, string> = {
    blockers: "known_issue",
    known: "known_issue",
    breaking: "breaking_change",
    api: "api_change",
    security: "security_related_fix",
    package: "package_change",
    feature: "feature",
    improvement: "improvement",
    fix: "fix",
    change: "change",
    docs: "documentation"
  };
  return map[laneId] ?? "change";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
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
