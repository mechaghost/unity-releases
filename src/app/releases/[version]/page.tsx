import { getRelease, searchReleaseNotes } from "@/lib/db/repositories";
import { cleanReleaseNoteText, normalizeIssueLinks } from "@/lib/release-notes/format";
import type { ReleaseNoteSearchFilters } from "@/lib/search";

export const dynamic = "force-dynamic";

type ReleaseNoteRow = {
  id: number;
  version: string;
  section: string;
  area?: string | null;
  platforms?: string[];
  impact_kind: string;
  risk_level: string;
  body: string;
  issue_ids?: string[];
  issue_links_json?: unknown;
  package_names?: string[];
  source_url: string;
  source_order: number;
  total_count?: string | number;
};

export default async function ReleasePage({
  params,
  searchParams
}: {
  params: Promise<{ version: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { version } = await params;
  const query = toUrlSearchParams(await searchParams);
  const release = await safeRelease(version);
  const filters = releaseFilters(version, query);
  const [notes, allNotes] = await Promise.all([safeNotes(filters), safeNotes({ version, limit: 5000, order: "source" })]);
  const total = Number(notes[0]?.total_count ?? notes.length);
  const allTotal = Number(allNotes[0]?.total_count ?? allNotes.length);
  const facets = releaseFacets(allNotes);
  const activeFilters = activeFilterLabels(filters);
  const grouped = groupNotes(notes, query.get("group") ?? "section");

  return (
    <div className="workbench">
      <section className="page-header">
        <div>
          <h1>Unity {version}</h1>
          <p className="muted">Release detail, official links, and searchable release-note items.</p>
        </div>
        <div className="stat-strip" aria-label="Release note summary">
          <span>
            <strong>{total}</strong>
            matches
          </span>
          <span>
            <strong>{allTotal}</strong>
            note items
          </span>
        </div>
      </section>

      {release ? (
        <section className="panel release-summary">
          <div>
            <h2>{release.stream}</h2>
            <p className="muted">
              {release.release_date ? new Date(release.release_date).toLocaleDateString() : "Unknown release date"}
              {release.changeset ? ` · Changeset ${release.changeset}` : ""}
            </p>
          </div>
          <div className="button-row">
            <a className="secondary-action" href={release.release_page_url}>
              Official release page
            </a>
            {release.unity_hub_deep_link ? (
              <a className="secondary-action" href={release.unity_hub_deep_link}>
                Open in Hub
              </a>
            ) : null}
          </div>
        </section>
      ) : (
        <p className="muted">Release not found in the database yet.</p>
      )}

      <div className="mode-tabs" aria-label="Release note quick filters">
        {releaseModeLink("All", version, query, { section: "", type: "", impact: "", risk: "" })}
        {releaseModeLink("Known Issues", version, query, { section: "Known Issues", type: "", impact: "", risk: "" })}
        {releaseModeLink("Fixes", version, query, { type: "fix", impact: "", section: "", risk: "" })}
        {releaseModeLink("Features", version, query, { section: "Features", type: "", impact: "", risk: "" })}
        {releaseModeLink("Improvements", version, query, { section: "Improvements", type: "", impact: "", risk: "" })}
        {releaseModeLink("Package Updates", version, query, { type: "package_change", impact: "", section: "", risk: "" })}
        {releaseModeLink("API Changes", version, query, { section: "API Changes", type: "", impact: "", risk: "" })}
        {releaseModeLink("Blockers", version, query, { risk: "blocker", section: "", type: "", impact: "" })}
      </div>

      <div className="release-detail-layout">
        <aside className="filter-rail" aria-label="Release filters">
          <form>
            <label className="field field-wide">
              <span>Search within {version}</span>
              <input name="q" placeholder="memory leak, UUM-136929, URP" defaultValue={filters.q} />
            </label>

            <label className="field">
              <span>Section</span>
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
              <span>Type / impact</span>
              <select name="type" defaultValue={filters.impactKind ?? ""}>
                <option value="">Any type</option>
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
              <span>Issue ID</span>
              <input name="issue" placeholder="UUM-136929" defaultValue={filters.issueId} />
            </label>

            <label className="field">
              <span>Order</span>
              <select name="order" defaultValue={filters.order ?? "source"}>
                <option value="source">Official order</option>
                <option value="section">Section</option>
                <option value="risk">Risk first</option>
                <option value="area">Area A-Z</option>
                <option value="issue">Issue ID</option>
                <option value="newest">Newest</option>
              </select>
            </label>

            <label className="field">
              <span>Group by</span>
              <select name="group" defaultValue={query.get("group") ?? "section"}>
                <option value="section">Section</option>
                <option value="impact">Type / impact</option>
                <option value="risk">Risk</option>
                <option value="area">Area</option>
              </select>
            </label>

            <label className="field">
              <span>Show</span>
              <select name="limit" defaultValue={String(filters.limit ?? 500)}>
                <option value="100">100 items</option>
                <option value="250">250 items</option>
                <option value="500">500 items</option>
                <option value="1000">1,000 items</option>
                <option value="2500">2,500 items</option>
              </select>
            </label>

            <div className="filter-actions">
              <button type="submit">Apply filters</button>
              <a className="secondary-action" href={`/releases/${version}`}>
                Clear
              </a>
            </div>
          </form>
        </aside>

        <section className="result-pane" aria-live="polite">
          <div className="result-toolbar">
            <div>
              <h2>{total ? `${total} release note items` : "No release note items matched"}</h2>
              <p className="muted">
                Showing {notes.length} of {total}. Compact rows with issue links and official source links.
              </p>
            </div>
            {activeFilters.length ? (
              <div className="chips" aria-label="Active filters">
                {activeFilters.map((label) => (
                  <span className="chip" key={label}>
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {grouped.length ? (
            <div className="version-groups">
              {grouped.map(([group, items]) => (
                <section className="version-group" key={group}>
                  <header>
                    <h2>{group}</h2>
                    <span className="muted">{items.length} items</span>
                  </header>
                  <div className="list compact-list">
                    {items.map((item) => (
                      <article className="note-row dense-note-row" key={item.id}>
                        <div className="note-row-top">
                          <span className={`badge risk-${item.risk_level}`}>{riskLabel(item.risk_level)}</span>
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
                            <a className="chip link-chip" href={`/packages/${encodeURIComponent(packageName)}`} key={packageName}>
                              {packageName}
                            </a>
                          ))}
                          {normalizeIssueLinks(item.issue_ids, item.issue_links_json).map((issue) => (
                            <span className="issue-chip-pair" key={issue.id}>
                              <a className="chip link-chip" href={`/issues/${encodeURIComponent(issue.id)}`}>
                                {issue.id}
                              </a>
                              <a className="chip link-chip" href={issue.url}>
                                Tracker
                              </a>
                            </span>
                          ))}
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
              <h2>No matches in this release</h2>
              <p>Try removing one filter or searching by UUM issue ID.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

async function safeRelease(version: string) {
  try {
    return await getRelease(version);
  } catch {
    return null;
  }
}

async function safeNotes(filters: ReleaseNoteSearchFilters) {
  try {
    return (await searchReleaseNotes(filters)) as ReleaseNoteRow[];
  } catch {
    return [];
  }
}

function releaseFilters(version: string, params: URLSearchParams): ReleaseNoteSearchFilters {
  const order = params.get("order");
  const limit = Number(params.get("limit") ?? 500);
  return {
    version,
    q: params.get("q") ?? undefined,
    section: params.get("section") ?? undefined,
    area: params.get("area") ?? undefined,
    platform: params.get("platform") ?? undefined,
    impactKind: params.get("type") ?? params.get("impact") ?? undefined,
    riskLevel: params.get("risk") ?? undefined,
    packageName: params.get("package") ?? undefined,
    issueId: params.get("issue") ?? undefined,
    order:
      order === "section" || order === "risk" || order === "newest" || order === "source" || order === "area" || order === "issue"
        ? order
        : "source",
    limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 2500) : 500
  };
}

function releaseFacets(notes: ReleaseNoteRow[]) {
  return {
    sections: unique(notes.map((note) => note.section)),
    impacts: unique(notes.map((note) => note.impact_kind)),
    risks: unique(notes.map((note) => note.risk_level)),
    areas: unique(
      (notes.map((note) => note.area).filter(Boolean) as string[]).filter((area) => !area.startsWith("com."))
    ),
    platforms: unique(notes.flatMap((note) => note.platforms ?? [])),
    packages: unique(notes.flatMap((note) => note.package_names ?? []))
  };
}

function groupNotes(notes: ReleaseNoteRow[], group: string): Array<[string, ReleaseNoteRow[]]> {
  const groups = new Map<string, ReleaseNoteRow[]>();
  for (const note of notes) {
    const key =
      group === "impact"
        ? impactLabel(note.impact_kind)
        : group === "risk"
          ? riskLabel(note.risk_level)
          : group === "area"
            ? note.area ?? "Unspecified area"
            : note.section;
    const current = groups.get(key) ?? [];
    current.push(note);
    groups.set(key, current);
  }
  return [...groups.entries()];
}

function activeFilterLabels(filters: ReleaseNoteSearchFilters) {
  return [
    filters.q ? `Search: ${filters.q}` : "",
    filters.section ? `Section: ${filters.section}` : "",
    filters.area ? `Area: ${filters.area}` : "",
    filters.platform ? `Platform: ${filters.platform}` : "",
    filters.impactKind ? `Type: ${joinLabels(filters.impactKind, impactLabel)}` : "",
    filters.riskLevel ? `Risk: ${joinLabels(filters.riskLevel, riskLabel)}` : "",
    filters.packageName ? `Package: ${filters.packageName}` : "",
    filters.issueId ? `Issue: ${filters.issueId}` : ""
  ].filter(Boolean);
}

function releaseModeLink(label: string, version: string, current: URLSearchParams, updates: Record<string, string>) {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(updates)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  const active = Object.entries(updates).every(([key, value]) =>
    value ? current.get(key) === value : !current.get(key)
  );
  return (
    <a className={active ? "active" : ""} href={`/releases/${version}${next.toString() ? `?${next}` : ""}`}>
      {label}
    </a>
  );
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

function unique(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
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
