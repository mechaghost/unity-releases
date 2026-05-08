import { filtersFromSearchParams } from "@/lib/api";
import {
  getIssueStatuses,
  listReleaseNoteFacets,
  searchReleaseNotes
} from "@/lib/db/repositories";
import { cleanReleaseNoteText } from "@/lib/release-notes/format";
import {
  issueStatusLabel,
  issueStatusSuffix,
  issueStatusTone,
  type IssueStatus
} from "@/lib/issue-status";
import { streamLabel } from "@/lib/stream-labels";

export const dynamic = "force-dynamic";

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
  source_url: string;
  source_order?: number;
  total_count?: string | number;
};

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
  const issueStatuses = await safeIssueStatuses(issueIds);

  return (
    <div className="workbench">
      <section className="page-header">
        <div>
          <h1>Release Notes</h1>
          <p className="muted">
            Search Unity 6 release notes by version, issue, subsystem, package, platform, and upgrade risk.
          </p>
        </div>
        <div className="stat-strip" aria-label="Search summary">
          <span>
            <strong>{total}</strong>
            matches
          </span>
          <span>
            <strong>{facets.versions.length}</strong>
            indexed versions
          </span>
        </div>
      </section>

      <div className="mode-tabs" aria-label="Release note modes">
        {modeLink("All", params, {})}
        {modeLink("Known Issues", params, { section: "Known Issues" })}
        {modeLink("Fixes", params, { impact: "fix", section: "" })}
        {modeLink("Package Updates", params, { impact: "package_change", section: "" })}
        {modeLink("API Changes", params, { section: "API Changes", impact: "" })}
        {modeLink("Blockers", params, { risk: "blocker" })}
      </div>

      <div className="explorer-layout">
        <aside className="filter-rail" aria-label="Release note filters">
          <form>
            <label className="field field-wide">
              <span>Search text or issue ID</span>
              <input name="q" placeholder="memory leak, UUM-136929, URP" defaultValue={filters.q} />
            </label>

            <label className="field">
              <span>Exact editor version</span>
              <select name="version" defaultValue={filters.version ?? ""}>
                <option value="">Any version</option>
                {facets.versions.map((version) => (
                  <option value={version} key={version}>
                    {version}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Unity line</span>
              <select name="minorLine" defaultValue={filters.minorLine ?? ""}>
                <option value="">Any line</option>
                {facets.minor_lines.map((line) => (
                  <option value={line} key={line}>
                    {line}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Stream</span>
              <select name="stream" defaultValue={filters.stream ?? ""}>
                <option value="">Any stream</option>
                {facets.streams.map((stream) => (
                  <option value={stream} key={stream}>
                    {streamLabel(stream)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Release note section</span>
              <select name="section" defaultValue={filters.section ?? ""}>
                <option value="">Any section</option>
                {facets.sections.map((section) => (
                  <option value={section} key={section}>
                    {section}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Subsystem / area</span>
              <select name="area" defaultValue={filters.area ?? ""}>
                <option value="">Any area</option>
                {facets.areas.map((area) => (
                  <option value={area} key={area}>
                    {area}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Platform</span>
              <select name="platform" defaultValue={filters.platform ?? ""}>
                <option value="">Any platform</option>
                {facets.platforms.map((platform) => (
                  <option value={platform} key={platform}>
                    {platform}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Impact</span>
              <select name="impact" defaultValue={filters.impactKind ?? ""}>
                <option value="">Any impact</option>
                {facets.impacts.map((impact) => (
                  <option value={impact} key={impact}>
                    {impactLabel(impact)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Risk</span>
              <select name="risk" defaultValue={filters.riskLevel ?? ""}>
                <option value="">Any risk</option>
                {facets.risks.map((risk) => (
                  <option value={risk} key={risk}>
                    {riskLabel(risk)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Package</span>
              <select name="package" defaultValue={filters.packageName ?? ""}>
                <option value="">Any package</option>
                {facets.packages.map((packageName) => (
                  <option value={packageName} key={packageName}>
                    {packageName}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Issue tracker ID</span>
              <input name="issue" placeholder="UUM-136929" defaultValue={filters.issueId} />
            </label>

            <div className="filter-actions">
              <button type="submit">Search notes</button>
              <a className="secondary-action" href="/explorer">
                Clear
              </a>
            </div>
          </form>
        </aside>

        <section className="result-pane" aria-live="polite">
          <div className="result-toolbar">
            <div>
              <h2>{total ? `${total} release note matches` : "No release notes matched"}</h2>
              <p className="muted">Grouped by editor version, newest first.</p>
            </div>
            {activeFilters.length ? (
              <div className="chips" aria-label="Active filters">
                {activeFilters.map((label) => (
                  <span className="chip" key={label}>
                    {label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="muted">Showing the latest indexed Unity 6 notes.</p>
            )}
          </div>

          {error ? (
            <div className="empty-state">
              <h2>Could not load release notes</h2>
              <p>Check the database connection and try again.</p>
            </div>
          ) : grouped.length ? (
            <div className="version-groups">
              {grouped.map(([version, items]) => (
                <section className="version-group" key={version}>
                  <header>
                    <h2>{version}</h2>
                    <span className="muted">{items.length} shown</span>
                  </header>
                  <div className="list compact-list">
                    {items.map((item) => (
                      <article className="note-row" key={item.id ?? `${item.version}-${item.source_order}`}>
                        <div className="note-row-top">
                          <span className={`badge risk-${item.risk_level ?? "info"}`}>
                            {riskLabel(item.risk_level)}
                          </span>
                          <span className="badge neutral">{impactLabel(item.impact_kind)}</span>
                          <strong>{item.section}</strong>
                          {item.area ? <span className="muted">{item.area}</span> : null}
                        </div>
                        <p>{cleanReleaseNoteText(item.body)}</p>
                        <div className="note-meta">
                          {(item.platforms ?? []).map((platform) => (
                            <span className="chip" key={platform}>
                              {platform}
                            </span>
                          ))}
                          {(item.package_names ?? []).map((packageName) => (
                            <a className="chip link-chip" href={`/packages?q=${encodeURIComponent(packageName)}`} key={packageName}>
                              {packageName}
                            </a>
                          ))}
                          {(item.issue_ids ?? []).map((issueId) => {
                            const status = issueStatuses.get(issueId);
                            const tone =
                              status && status.kind !== "unknown" ? issueStatusTone(status) : null;
                            const suffix = status ? issueStatusSuffix(status) : null;
                            const titleSuffix =
                              status && status.kind !== "unknown" ? ` — ${issueStatusLabel(status)}` : "";
                            return (
                              <a
                                className="chip chip--issue link-chip"
                                data-status={tone ?? undefined}
                                href={`/issues/${encodeURIComponent(issueId)}`}
                                key={issueId}
                                title={`${issueId}${titleSuffix}`}
                              >
                                <span className="chip--issue__id">{issueId}</span>
                                {suffix ? <span className="chip--issue__suffix">{suffix}</span> : null}
                              </a>
                            );
                          })}
                          <a href={item.source_url}>Official source</a>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2>No matches for these filters</h2>
              <p>Try removing one facet, switching to a Unity line, or searching by issue ID.</p>
            </div>
          )}
        </section>
      </div>
    </div>
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

async function safeIssueStatuses(ids: string[]): Promise<Map<string, IssueStatus>> {
  if (ids.length === 0) return new Map();
  try {
    return await getIssueStatuses(ids);
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

function modeLink(label: string, current: URLSearchParams, updates: Record<string, string>) {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(updates)) {
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
  }
  next.delete("offset");
  const active = Object.keys(updates).length
    ? Object.entries(updates).every(([key, value]) => current.get(key) === value)
    : !current.get("section") && !current.get("impact") && !current.get("risk");
  return (
    <a className={active ? "active" : ""} href={`/explorer${next.toString() ? `?${next}` : ""}`}>
      {label}
    </a>
  );
}

function joinLabels(value: string | string[] | undefined, fn: (v: string | null | undefined) => string): string {
  return (Array.isArray(value) ? value : [value]).map(fn).join(", ");
}

function impactLabel(value?: string | null) {
  const labels: Record<string, string> = {
    fix: "Fix gained",
    known_issue: "Known issue",
    api_change: "API change",
    breaking_change: "Breaking/API",
    package_change: "Package update",
    platform_risk: "Platform impact",
    install_risk: "Install/Hub",
    security_related_fix: "Security fix",
    upgrade_blocker: "Upgrade blocker",
    documentation: "Documentation",
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
