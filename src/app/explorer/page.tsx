import { filtersFromSearchParams } from "@/lib/api";
import {
  getIssueStatuses,
  listReleaseNoteFacets,
  searchReleaseNotes
} from "@/lib/db/repositories";
import { type IssueStatus } from "@/lib/issue-status";
import { streamLabel } from "@/lib/stream-labels";
import { NoteRow, type NoteRowData } from "../_components/NoteRow";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Release Notes Search",
  description:
    "Faceted search across every indexed Unity release-note row — filter by version, issue, subsystem, package, platform, and upgrade risk.",
  alternates: { canonical: "/explorer" }
};

type ReleaseNoteRow = {
  id?: number;
  version: string;
  minor_line?: string;
  stream?: string;
  section: string;
  area?: string | null;
  platforms?: string[];
  impact_kind?: string;
  risk_level?: string;
  body: string;
  issue_ids?: string[];
  package_names?: string[];
  issue_links_json?: unknown;
  source_url: string;
  source_order?: number;
  total_count?: string | number;
};

function toNoteRowData(row: ReleaseNoteRow): NoteRowData {
  return {
    id: row.id ?? row.source_order ?? 0,
    version: row.version,
    section: row.section,
    area: row.area ?? null,
    body: row.body,
    impact_kind: row.impact_kind ?? "unknown",
    risk_level: row.risk_level ?? "info",
    platforms: row.platforms ?? [],
    package_names: row.package_names ?? [],
    issue_ids: row.issue_ids ?? [],
    issue_links_json: row.issue_links_json ?? null
  };
}

export default async function ExplorerPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = toUrlSearchParams(await searchParams);
  const filters = filtersFromSearchParams(params);
  const [{ results, error }, facets] = await Promise.all([safeSearch(filters), safeFacets()]);
  const total = Number(results[0]?.total_count ?? results.length);
  const grouped = groupByVersion(results);
  const activeFilters = activeFilterLabels(filters);
  const issueIds = uniqueValues(results.flatMap((r) => r.issue_ids ?? []));
  // Scope issue-status derivation to the majors actually present in the
  // result set. Without this, a UUM-xxxxx mentioned only on a 2019.4
  // row would still get tagged "fixed in 6000.3.0b1" if Unity shipped
  // the fix exclusively on the Unity 6 line — misleading for a user
  // who's filtered to 2019/2020/2021/2022 results. Same scoping rule
  // /compare uses, just derived from `results` instead of `range.versions`.
  const relevantMajors = new Set<number>(
    results
      .map((r) => Number(r.version.slice(0, r.version.indexOf("."))))
      .filter((n) => Number.isFinite(n))
  );
  const issueStatuses = await safeIssueStatuses(issueIds, relevantMajors);

  return (
    <>
      <section className="page-header">
        <h1>Release Notes Search</h1>
        <p>
          Faceted search across every indexed Unity release-note row.
          Filter by version, issue, subsystem, package, platform, or
          upgrade risk. <strong>{total.toLocaleString()}</strong> matches
          across <strong>{facets.versions.length.toLocaleString()}</strong>{" "}
          indexed versions.
        </p>
      </section>

      <form className="filter-bar explorer-filter" method="get" action="/explorer">
        <label>
          <span>Search</span>
          <input
            type="search"
            name="q"
            placeholder="memory leak, UUM-136929, URP…"
            defaultValue={filters.q ?? ""}
          />
        </label>
        <label>
          <span>Version</span>
          <select name="version" defaultValue={filters.version ?? ""} aria-label="Exact editor version">
            <option value="">Any version</option>
            {facets.versions.map((version) => (
              <option value={version} key={version}>
                {version}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Line</span>
          <select name="minorLine" defaultValue={filters.minorLine ?? ""} aria-label="Unity minor line">
            <option value="">Any line</option>
            {facets.minor_lines.map((line) => (
              <option value={line} key={line}>
                {line}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Stream</span>
          <select name="stream" defaultValue={filters.stream ?? ""} aria-label="Release stream">
            <option value="">Any stream</option>
            {facets.streams.map((stream) => (
              <option value={stream} key={stream}>
                {streamLabel(stream)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Section</span>
          <select name="section" defaultValue={filters.section ?? ""} aria-label="Release-note section">
            <option value="">Any section</option>
            {facets.sections.map((section) => (
              <option value={section} key={section}>
                {section}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Area</span>
          <select name="area" defaultValue={filters.area ?? ""} aria-label="Subsystem area">
            <option value="">Any area</option>
            {facets.areas.map((area) => (
              <option value={area} key={area}>
                {area}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Platform</span>
          <select name="platform" defaultValue={filters.platform ?? ""} aria-label="Platform">
            <option value="">Any platform</option>
            {facets.platforms.map((platform) => (
              <option value={platform} key={platform}>
                {platform}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Impact</span>
          <select name="impact" defaultValue={String(filters.impactKind ?? "")} aria-label="Impact kind">
            <option value="">Any impact</option>
            {facets.impacts.map((impact) => (
              <option value={impact} key={impact}>
                {impactLabel(impact)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Risk</span>
          <select name="risk" defaultValue={String(filters.riskLevel ?? "")} aria-label="Risk level">
            <option value="">Any risk</option>
            {facets.risks.map((risk) => (
              <option value={risk} key={risk}>
                {riskLabel(risk)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Package</span>
          <select name="package" defaultValue={filters.packageName ?? ""} aria-label="Package">
            <option value="">Any package</option>
            {facets.packages.map((packageName) => (
              <option value={packageName} key={packageName}>
                {packageName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Issue ID</span>
          <input
            type="search"
            name="issue"
            placeholder="UUM-136929"
            defaultValue={filters.issueId ?? ""}
          />
        </label>
        <button type="submit" className="btn btn--primary">
          Search
        </button>
        <a href="/explorer" className="explorer-filter__clear">
          Clear
        </a>
      </form>

      <div className="list-toolbar">
        <span className="list-toolbar__count">
          <strong>{total.toLocaleString()}</strong>{" "}
          {total === 1 ? "match" : "matches"}
          {activeFilters.length > 0 ? <> · {activeFilters.length} active filter{activeFilters.length === 1 ? "" : "s"}</> : null}
        </span>
        {activeFilters.length > 0 ? (
          <div className="filter-chip-row" aria-label="Active filters">
            {activeFilters.map((label) => (
              <span className="filter-active-chip" key={label}>
                {label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="empty-state">
          <h2>Could not load release notes.</h2>
          <p>The database is unreachable or the query timed out. Try narrowing the filters.</p>
        </div>
      ) : grouped.length === 0 ? (
        <div className="empty-state">
          <h2>No release notes match these filters.</h2>
          <p>
            Loosen a facet, switch to a Unity minor line, or search by issue ID
            (e.g. <code>UUM-136929</code>).
          </p>
        </div>
      ) : (
        <div className="explorer-results">
          {grouped.map(([version, items]) => (
            <section className="lane" key={version} aria-label={`Release notes for ${version}`}>
              <header className="lane__header" style={{ cursor: "default" }}>
                <span className="lane__header-title">{version}</span>
                <span className="lane__header-count tabnums">
                  {items.length} shown
                </span>
              </header>
              <div className="lane__body">
                {items.map((item) => (
                  <NoteRow
                    key={item.id ?? `${item.version}-${item.source_order}`}
                    row={toNoteRowData(item)}
                    showImpactPill={true}
                    issueStatuses={issueStatuses}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

async function safeSearch(filters: ReturnType<typeof filtersFromSearchParams>) {
  try {
    const results = (await searchReleaseNotes({ ...filters, limit: filters.limit ?? 100 })) as ReleaseNoteRow[];
    return { results, error: false };
  } catch {
    return { results: [] as ReleaseNoteRow[], error: true };
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

async function safeFacets() {
  try {
    return await listReleaseNoteFacets();
  } catch {
    return {
      versions: [],
      minor_lines: [],
      streams: [],
      sections: [],
      areas: [],
      platforms: [],
      impacts: [],
      risks: [],
      packages: []
    };
  }
}

function toUrlSearchParams(input: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value) {
      params.set(key, value);
    }
  }
  return params;
}

function groupByVersion(results: ReleaseNoteRow[]): Array<[string, ReleaseNoteRow[]]> {
  const groups = new Map<string, ReleaseNoteRow[]>();
  for (const item of results) {
    const group = groups.get(item.version) ?? [];
    group.push(item);
    groups.set(item.version, group);
  }
  return [...groups.entries()];
}

function activeFilterLabels(filters: ReturnType<typeof filtersFromSearchParams>) {
  return [
    filters.q ? `Search: ${filters.q}` : "",
    filters.version ? `Version: ${filters.version}` : "",
    filters.minorLine ? `Line: ${filters.minorLine}` : "",
    filters.stream ? `Stream: ${streamLabel(filters.stream)}` : "",
    filters.section ? `Section: ${filters.section}` : "",
    filters.area ? `Area: ${filters.area}` : "",
    filters.platform ? `Platform: ${filters.platform}` : "",
    filters.impactKind ? `Impact: ${joinLabels(filters.impactKind, impactLabel)}` : "",
    filters.riskLevel ? `Risk: ${joinLabels(filters.riskLevel, riskLabel)}` : "",
    filters.packageName ? `Package: ${filters.packageName}` : "",
    filters.issueId ? `Issue: ${filters.issueId}` : ""
  ].filter(Boolean);
}

function joinLabels(value: string | string[] | undefined, fn: (v: string | null | undefined) => string): string {
  return (Array.isArray(value) ? value : [value]).map(fn).join(", ");
}

function impactLabel(value?: string | null) {
  const labels: Record<string, string> = {
    fix: "Fix",
    known_issue: "Known issue",
    api_change: "API change",
    breaking_change: "Breaking",
    package_change: "Package",
    platform_risk: "Platform",
    install_risk: "Install",
    security_related_fix: "Security",
    upgrade_blocker: "Blocker",
    documentation: "Docs",
    unknown: "Unclassified"
  };
  return labels[value ?? ""] ?? titleize(value ?? "info");
}

function riskLabel(value?: string | null) {
  const labels: Record<string, string> = {
    blocker: "Blocker",
    caution: "Caution",
    review: "Review",
    info: "Info"
  };
  return labels[value ?? ""] ?? "Info";
}

function titleize(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
