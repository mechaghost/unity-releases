import { unstable_cache } from "next/cache";
import { query } from "./db/client";
import { DOMAINS, type Domain } from "./visualizer-domains";
import type { ScoreInput } from "./score";

export { DOMAINS, type Domain } from "./visualizer-domains";

/**
 * Cache TTL (seconds) for the two heaviest SQL paths — getScoreInputs
 * and getVersionAggregates. Both seq-scan the 154k-row
 * release_note_items table and are called from every score-using page.
 *
 * Ingestion runs at 00:00 + 12:00 UTC, so 10-minute staleness is below
 * the data's actual refresh cadence — users never see less-fresh data
 * than they would with `force-dynamic`, but most renders skip ~300ms of
 * SQL work entirely.
 */
const SCORE_DATA_TTL_SECONDS = 600;

/**
 * Data layer for the `/visualizer` page. Each exported function powers
 * one chart or fact panel. SQL is intentionally simple aggregate work
 * against `release_note_items` / `unity_releases` / `package_versions`
 * — no derived "scores," no editorial weighting. Personas were clear
 * that raw counts with visible formulas beat made-up ratings.
 *
 * Edge-safe constants (DOMAINS / Domain) live in `visualizer-domains.ts`
 * so client components can import them without pulling `pg` through
 * this module — see CLAUDE.md "middleware bundle pulling in Node-only
 * deps" failure mode.
 */

const DOMAIN_PATTERNS: Record<Domain, RegExp> = {
  Rendering: /^(URP|HDRP|SRP|Rendering|Graphics|Shaders?|Shader Graph|Post[- ]?processing|Lighting|GPU|Render Pipeline|Visual Effect|VFX|Camera)/i,
  Scripting: /^(Scripting|C#|IL2CPP|Burst|Mono|Job System|DOTS|Entities|ECS|Compiler|Roslyn)/i,
  Mobile: /^(Android|iOS|Mobile)/i,
  XR: /^(XR|AR|VR|OpenXR|VisionOS|MR|MARS)/i,
  Physics: /^(Physics|Physics 2D|Cloth)/i,
  UI: /^(UI|UI Toolkit|UI Builder|UIElements|IMGUI|UGUI|TextMesh)/i,
  Networking: /^(Networking|Netcode|Multiplayer|Transport|Relay|Lobby)/i,
  Editor: /^(Editor|Inspector|Hierarchy|Scene Manag|Project Browser|Preferences|Build Profile)/i,
  Audio: /^(Audio|Sound|DSP)/i,
  Animation: /^(Animation|Animator|Timeline|Mecanim)/i,
  "Asset Pipeline": /^(Asset|Import|Asset Bundle|Addressables|AssetDatabase|Prefab|Texture|Mesh|Loading)/i,
  Input: /^(Input|Input System|Touch|Pointer|Gamepad|Keyboard|Mouse)/i
};

export function classifyDomain(area: string | null | undefined): Domain | "Other" {
  if (!area) return "Other";
  for (const domain of DOMAINS) {
    if (DOMAIN_PATTERNS[domain].test(area)) return domain;
  }
  return "Other";
}

function buildDomainCaseExpression(): string {
  // CASE WHEN area ~* '^(URP|HDRP|…)' THEN 'Rendering' WHEN … ELSE 'Other' END
  const branches = DOMAINS.map((domain) => {
    const source = DOMAIN_PATTERNS[domain].source.replace(/'/g, "''");
    return `WHEN area ~* '${source}' THEN '${domain}'`;
  }).join(" ");
  return `CASE ${branches} ELSE 'Other' END`;
}

const DOMAIN_CASE = buildDomainCaseExpression();

export type StreamSlug = "lts" | "stable" | "beta" | "alpha";

const STREAM_DB_MAP: Record<StreamSlug, string[]> = {
  lts: ["LTS"],
  stable: ["STABLE", "TECH"],
  beta: ["BETA"],
  alpha: ["ALPHA"]
};

export function streamsToDbValues(slugs: StreamSlug[] | undefined): string[] | null {
  if (!slugs || slugs.length === 0) return null;
  const out = new Set<string>();
  for (const slug of slugs) {
    for (const v of STREAM_DB_MAP[slug] ?? []) out.add(v);
  }
  return [...out];
}

export type VersionAggregate = {
  version: string;
  releaseDate: string | null;
  stream: string;
  minorLine: string;
  fixes: number;
  knownIssues: number;
  breaking: number;
  apiChanges: number;
  security: number;
  features: number;
  packageChanges: number;
  blockers: number;
  mobileBlockers: number;
  total: number;
  /** raw integer = fixes − knownIssues. Positive = net positive release. */
  netFix: number;
};

/**
 * Per-version aggregate counts across every impact lane that matters
 * for the visualizer. Optional domain filter narrows every count to
 * notes whose `area` maps to that domain bucket; useful when the user
 * pins the page to "Rendering" or "Mobile."
 */
type VersionAggregateOptions = {
  domain?: Domain | "Other";
  streams?: StreamSlug[];
  limit?: number;
};

export async function getVersionAggregates(
  options: VersionAggregateOptions
): Promise<VersionAggregate[]> {
  // Delegate to the cached inner — cache keyed on the canonical option
  // shape, so identical params share a cache entry across pages.
  return cachedVersionAggregates(canonicalizeAggregateOptions(options));
}

function canonicalizeAggregateOptions(
  options: VersionAggregateOptions
): VersionAggregateOptions {
  // Sort streams so the cache key is order-independent.
  return {
    domain: options.domain,
    streams: options.streams ? [...options.streams].sort() : undefined,
    limit: options.limit ?? 120
  };
}

const cachedVersionAggregates = unstable_cache(
  async (options: VersionAggregateOptions): Promise<VersionAggregate[]> => {
    return getVersionAggregatesImpl(options);
  },
  ["visualizer:getVersionAggregates"],
  { revalidate: SCORE_DATA_TTL_SECONDS, tags: ["score-data"] }
);

async function getVersionAggregatesImpl(options: VersionAggregateOptions): Promise<VersionAggregate[]> {
  const params: unknown[] = [];
  const noteJoinConds: string[] = [];
  const releaseWhereConds: string[] = ["r.release_date IS NOT NULL"];

  if (options.domain) {
    params.push(options.domain);
    noteJoinConds.push(`${DOMAIN_CASE.replace(/area/g, "n.area")} = $${params.length}`);
  }
  const streamValues = streamsToDbValues(options.streams);
  if (streamValues) {
    params.push(streamValues);
    releaseWhereConds.push(`r.stream = ANY($${params.length}::text[])`);
  }

  const limit = options.limit ?? 120;
  params.push(limit);

  const result = await query<{
    version: string;
    release_date: string | null;
    stream: string;
    minor_line: string;
    fixes: string;
    known_issues: string;
    breaking: string;
    api_changes: string;
    security: string;
    features: string;
    package_changes: string;
    blockers: string;
    mobile_blockers: string;
    total: string;
  }>(
    `
      SELECT
        r.version,
        r.release_date::text AS release_date,
        r.stream,
        r.minor_line,
        COALESCE(SUM(CASE WHEN n.impact_kind = 'fix'                    THEN 1 ELSE 0 END), 0)::text AS fixes,
        COALESCE(SUM(CASE WHEN n.impact_kind = 'known_issue'            THEN 1 ELSE 0 END), 0)::text AS known_issues,
        COALESCE(SUM(CASE WHEN n.impact_kind = 'breaking_change'        THEN 1 ELSE 0 END), 0)::text AS breaking,
        COALESCE(SUM(CASE WHEN n.impact_kind = 'api_change'             THEN 1 ELSE 0 END), 0)::text AS api_changes,
        COALESCE(SUM(CASE WHEN n.impact_kind = 'security_related_fix'   THEN 1 ELSE 0 END), 0)::text AS security,
        COALESCE(SUM(CASE WHEN n.impact_kind = 'feature'                THEN 1 ELSE 0 END), 0)::text AS features,
        COALESCE(SUM(CASE WHEN n.impact_kind = 'package_change'         THEN 1 ELSE 0 END), 0)::text AS package_changes,
        COALESCE(SUM(CASE WHEN n.impact_kind = 'known_issue' AND n.risk_level = 'blocker' THEN 1 ELSE 0 END), 0)::text AS blockers,
        COALESCE(SUM(CASE WHEN n.impact_kind = 'known_issue' AND ('Android' = ANY(n.platforms) OR 'iOS' = ANY(n.platforms)) THEN 1 ELSE 0 END), 0)::text AS mobile_blockers,
        COALESCE(COUNT(n.id), 0)::text AS total
      FROM unity_releases r
      LEFT JOIN release_note_items n ON n.unity_release_id = r.id
        ${noteJoinConds.length > 0 ? `AND ${noteJoinConds.join(" AND ")}` : ""}
      WHERE ${releaseWhereConds.join(" AND ")}
      GROUP BY r.id, r.version, r.release_date, r.stream, r.minor_line
      ORDER BY r.release_date DESC, r.version DESC
      LIMIT $${params.length}
    `,
    params
  );

  return result.rows.map((row) => {
    const fixes = Number(row.fixes);
    const knownIssues = Number(row.known_issues);
    return {
      version: row.version,
      releaseDate: row.release_date,
      stream: row.stream,
      minorLine: row.minor_line,
      fixes,
      knownIssues,
      breaking: Number(row.breaking),
      apiChanges: Number(row.api_changes),
      security: Number(row.security),
      features: Number(row.features),
      packageChanges: Number(row.package_changes),
      blockers: Number(row.blockers),
      mobileBlockers: Number(row.mobile_blockers),
      total: Number(row.total),
      netFix: fixes - knownIssues
    };
  });
}

export type AreaHeatmapCell = {
  domain: Domain | "Other";
  version: string;
  releaseDate: string | null;
  breakingCount: number;
  apiCount: number;
  total: number;
};

/**
 * Pivot table for the breaking-change heatmap: rows = curated domain,
 * cols = recent versions, cell value = count of breaking + api notes.
 * Limited to the supplied versions (passed from the version aggregate
 * query so both charts stay in sync).
 */
export async function getAreaHeatmap(versions: string[]): Promise<AreaHeatmapCell[]> {
  if (versions.length === 0) return [];
  const result = await query<{
    domain: string;
    version: string;
    release_date: string | null;
    breaking: string;
    api: string;
  }>(
    `
      SELECT
        ${DOMAIN_CASE} AS domain,
        n.version,
        n.release_date::text AS release_date,
        SUM(CASE WHEN n.impact_kind = 'breaking_change' THEN 1 ELSE 0 END)::text AS breaking,
        SUM(CASE WHEN n.impact_kind = 'api_change'      THEN 1 ELSE 0 END)::text AS api
      FROM release_note_items n
      WHERE n.version = ANY($1::text[])
        AND n.impact_kind IN ('breaking_change', 'api_change')
      GROUP BY ${DOMAIN_CASE}, n.version, n.release_date
    `,
    [versions]
  );

  return result.rows.map((row) => {
    const breaking = Number(row.breaking);
    const api = Number(row.api);
    return {
      domain: (row.domain as Domain | "Other") ?? "Other",
      version: row.version,
      releaseDate: row.release_date,
      breakingCount: breaking,
      apiCount: api,
      total: breaking + api
    };
  });
}

export type IssueLifespan = {
  issueId: string;
  introducedVersion: string | null;
  introducedDate: string | null;
  fixedVersion: string | null;
  fixedDate: string | null;
  daysOpen: number | null;
  /** Sample area label from the first known-issue mention (for grouping). */
  area: string | null;
  /** True if the issue has been flagged as a blocker risk-level anywhere. */
  hadBlocker: boolean;
};

/**
 * Issue lifespan from earliest known-issue mention to earliest fix
 * mention. Ranks by days-open descending so the most stubborn bugs
 * surface first. `fixedDate` null means still open as of latest data.
 *
 * Joins against `issue_mentions` which carries the section per mention,
 * letting us split known-issue vs fix without re-parsing.
 */
export async function getIssueLifespans(options: {
  domain?: Domain | "Other";
  limit?: number;
  /** When true, only return issues that have NOT been fixed. */
  onlyOpen?: boolean;
}): Promise<IssueLifespan[]> {
  const params: unknown[] = [];
  const conds: string[] = [];

  if (options.domain) {
    params.push(options.domain);
    conds.push(`(${DOMAIN_CASE.replace(/area/g, "im.area")}) = $${params.length}`);
  }
  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";
  const limit = options.limit ?? 40;
  params.push(limit);

  const result = await query<{
    issue_id: string;
    introduced_version: string | null;
    introduced_date: string | null;
    fixed_version: string | null;
    fixed_date: string | null;
    days_open: string | null;
    area: string | null;
    had_blocker: boolean;
  }>(
    `
      WITH first_known AS (
        SELECT DISTINCT ON (im.issue_id)
          im.issue_id, ur.version, ur.release_date, im.area
        FROM issue_mentions im
        JOIN unity_releases ur ON ur.id = im.unity_release_id
        WHERE im.section = 'Known Issues'
        ORDER BY im.issue_id, ur.release_date ASC NULLS LAST
      ),
      first_fix AS (
        SELECT DISTINCT ON (im.issue_id)
          im.issue_id, ur.version, ur.release_date
        FROM issue_mentions im
        JOIN unity_releases ur ON ur.id = im.unity_release_id
        WHERE im.section = 'Fixes'
        ORDER BY im.issue_id, ur.release_date ASC NULLS LAST
      ),
      blocker_flag AS (
        SELECT DISTINCT n.issue_ids[ord] AS issue_id
        FROM release_note_items n,
             generate_subscripts(n.issue_ids, 1) AS ord
        WHERE n.risk_level = 'blocker'
      )
      SELECT
        fk.issue_id,
        fk.version       AS introduced_version,
        fk.release_date::text  AS introduced_date,
        ff.version       AS fixed_version,
        ff.release_date::text  AS fixed_date,
        CASE
          WHEN ff.release_date IS NOT NULL AND fk.release_date IS NOT NULL
            THEN EXTRACT(EPOCH FROM (ff.release_date - fk.release_date)) / 86400
          WHEN fk.release_date IS NOT NULL
            THEN EXTRACT(EPOCH FROM (now() - fk.release_date)) / 86400
          ELSE NULL
        END::text AS days_open,
        fk.area,
        (bf.issue_id IS NOT NULL) AS had_blocker
      FROM first_known fk
      LEFT JOIN first_fix    ff ON ff.issue_id = fk.issue_id
      LEFT JOIN blocker_flag bf ON bf.issue_id = fk.issue_id
      ${options.onlyOpen ? "WHERE ff.issue_id IS NULL" : ""}
      ${conds.length > 0 ? (options.onlyOpen ? "AND" : "WHERE") + " " + conds.map((c) => c.replace(/im\.area/g, "fk.area")).join(" AND ") : ""}
      ORDER BY days_open DESC NULLS LAST
      LIMIT $${params.length}
    `,
    params
  );

  return result.rows.map((row) => ({
    issueId: row.issue_id,
    introducedVersion: row.introduced_version,
    introducedDate: row.introduced_date,
    fixedVersion: row.fixed_version,
    fixedDate: row.fixed_date,
    daysOpen: row.days_open != null ? Number(row.days_open) : null,
    area: row.area,
    hadBlocker: Boolean(row.had_blocker)
  }));
}

export type PackageMatrixRow = {
  editorVersion: string;
  editorDate: string | null;
  stream: string;
  /** Map of package name → resolved version at this editor's release date. */
  packages: Record<string, { version: string | null; publishedAt: string | null }>;
};

/**
 * Editor-by-package matrix. For each of the recent N editor releases,
 * resolve each curated package's latest compatible version as of that
 * editor's release_date. Approximates the "shipped with" relationship.
 *
 * Uses LATERAL so the per-cell subquery is selectable in one round-trip.
 */
export async function getPackageEditorMatrix(options: {
  editorLimit?: number;
  packageNames?: string[];
}): Promise<{ rows: PackageMatrixRow[]; packages: string[] }> {
  const editorLimit = options.editorLimit ?? 16;
  const requestedPackages =
    options.packageNames && options.packageNames.length > 0 ? options.packageNames : null;

  let packageNames: string[];
  if (requestedPackages) {
    packageNames = requestedPackages;
  } else {
    // Top 8 packages by version count — a reasonable proxy for "active"
    // packages we have enough history on to meaningfully render.
    const topRows = await query<{ name: string }>(
      `
        SELECT p.name
        FROM packages p
        JOIN package_versions pv ON pv.package_id = p.id
        GROUP BY p.name
        ORDER BY COUNT(*) DESC
        LIMIT 8
      `
    );
    packageNames = topRows.rows.map((r) => r.name);
  }

  if (packageNames.length === 0) return { rows: [], packages: [] };

  const result = await query<{
    editor_version: string;
    editor_date: string | null;
    stream: string;
    pkg_name: string;
    pkg_version: string | null;
    pkg_published_at: string | null;
  }>(
    `
      SELECT
        ur.version          AS editor_version,
        ur.release_date::text AS editor_date,
        ur.stream,
        p.name              AS pkg_name,
        pv.version          AS pkg_version,
        pv.published_at::text AS pkg_published_at
      FROM (
        SELECT id, version, release_date, stream
        FROM unity_releases
        WHERE release_date IS NOT NULL
        ORDER BY release_date DESC
        LIMIT $1
      ) ur
      CROSS JOIN packages p
      LEFT JOIN LATERAL (
        SELECT version, published_at
        FROM package_versions
        WHERE package_id = p.id
          AND (published_at IS NULL OR published_at <= ur.release_date)
        ORDER BY published_at DESC NULLS LAST, version DESC
        LIMIT 1
      ) pv ON true
      WHERE p.name = ANY($2::text[])
    `,
    [editorLimit, packageNames]
  );

  const rowMap = new Map<string, PackageMatrixRow>();
  for (const row of result.rows) {
    const key = row.editor_version;
    let entry = rowMap.get(key);
    if (!entry) {
      entry = {
        editorVersion: row.editor_version,
        editorDate: row.editor_date,
        stream: row.stream,
        packages: {}
      };
      rowMap.set(key, entry);
    }
    entry.packages[row.pkg_name] = {
      version: row.pkg_version,
      publishedAt: row.pkg_published_at
    };
  }

  const rows = [...rowMap.values()].sort((a, b) => {
    const ad = a.editorDate ?? "";
    const bd = b.editorDate ?? "";
    return bd.localeCompare(ad);
  });

  return { rows, packages: packageNames };
}

export type PatchCadencePoint = {
  version: string;
  releaseDate: string;
  stream: string;
  minorLine: string;
};

/**
 * All releases inside the supplied window, ordered for the dot-plot.
 * The y position is per-stream so the chart can stack streams
 * (LTS / Tech / Beta / Alpha) without overplotting.
 */
export async function getPatchCadence(options: {
  monthsBack?: number;
}): Promise<PatchCadencePoint[]> {
  const monthsBack = options.monthsBack ?? 18;
  const result = await query<{
    version: string;
    release_date: string;
    stream: string;
    minor_line: string;
  }>(
    `
      SELECT version, release_date::text AS release_date, stream, minor_line
      FROM unity_releases
      WHERE release_date IS NOT NULL
        AND release_date > now() - ($1 || ' months')::interval
      ORDER BY release_date ASC
    `,
    [String(monthsBack)]
  );
  return result.rows.map((row) => ({
    version: row.version,
    releaseDate: row.release_date,
    stream: row.stream,
    minorLine: row.minor_line
  }));
}

export type VersionFact = {
  id: string;
  label: string;
  value: string;
  /** Short hint at how this number was computed. Required — personas were
   *  emphatic that any number on this page must be auditable. */
  formula: string;
  /** Optional drilldown URL (release detail, issue page, etc). */
  href?: string;
};

/**
 * The 10 dynamic facts shown in the side panel.
 *
 * Six of the original facts (lowest-known, most-fixes, most-breaking,
 * most-security, most-features, biggest-patch) all reduce to the same
 * shape: "for each release, count notes matching impact_kind X; pick
 * max." That used to be six independent queries — now one CTE-prefixed
 * query computes them in a single scan via `COUNT(*) FILTER`.
 *
 * The domain filter is also parameterized ($1 nullable) — previously
 * the user-selected domain was string-interpolated into SQL with a
 * defensive single-quote escape, which the audit flagged as fragile.
 *
 * Four facts remain separate queries because they hit different tables
 * (package_versions, issue_mentions) or use window functions.
 */
export async function getVersionFacts(options: {
  domain?: Domain | "Other";
}): Promise<VersionFact[]> {
  // For the issue-mentions CTEs (facts #4 + #8) we still apply the
  // domain filter against a CTE-projected `area` column. These use
  // their own DOMAIN_CASE expression because parameterizing into a CTE
  // with cross-references gets noisy; the literal is still re-built
  // from the static `DOMAINS` allowlist so it can't be subverted.
  const issueDomainCond = options.domain
    ? `AND (${DOMAIN_CASE.replace(/area/g, "k.area")}) = '${options.domain.replace(/'/g, "''")}'`
    : "";

  const domainParam = options.domain ?? null;

  const [perVersionFacts, longestOpen, mostChurnPackage, fastestFix, quietestSinceRelease] =
    await Promise.all([
      // Six per-version aggregates in one scan. The shared CTE scans
      // release_note_items once with the domain filter; each subquery
      // selects max-by a different `COUNT(*) FILTER` column.
      query<{
        lowest_known_version: string | null;
        lowest_known_cnt: string | null;
        most_fixes_version: string | null;
        most_fixes_cnt: string | null;
        most_breaking_version: string | null;
        most_breaking_cnt: string | null;
        most_security_version: string | null;
        most_security_cnt: string | null;
        most_features_version: string | null;
        most_features_cnt: string | null;
        biggest_patch_version: string | null;
        biggest_patch_cnt: string | null;
      }>(
        `
          WITH per_version AS (
            SELECT
              n.version,
              MAX(n.release_date) AS release_date,
              COUNT(*)                                                   AS total,
              COUNT(*) FILTER (WHERE n.impact_kind = 'fix')              AS fixes,
              COUNT(*) FILTER (WHERE n.impact_kind = 'known_issue')      AS known_issues,
              COUNT(*) FILTER (WHERE n.impact_kind = 'breaking_change')  AS breaking,
              COUNT(*) FILTER (WHERE n.impact_kind = 'security_related_fix') AS security,
              COUNT(*) FILTER (WHERE n.impact_kind = 'feature')          AS features
            FROM release_note_items n
            WHERE ($1::text IS NULL OR ${DOMAIN_CASE} = $1::text)
            GROUP BY n.version
          )
          -- NOTE: every ORDER BY in the per_version subqueries below
          -- must be prefixed with pv. so Postgres resolves the identifier
          -- to the CTE column rather than the text-cast in the SELECT
          -- list. Without pv., a SELECT fixes::text ... ORDER BY fixes
          -- subquery sorts the text representation, placing 991 before
          -- 2684. Caught in audit testing.
          SELECT
            (SELECT pv.version FROM per_version pv
               WHERE pv.release_date > now() - interval '12 months' AND pv.total > 5
               ORDER BY pv.known_issues ASC, pv.version DESC LIMIT 1)    AS lowest_known_version,
            (SELECT pv.known_issues::text FROM per_version pv
               WHERE pv.release_date > now() - interval '12 months' AND pv.total > 5
               ORDER BY pv.known_issues ASC, pv.version DESC LIMIT 1)    AS lowest_known_cnt,
            (SELECT pv.version FROM per_version pv
               WHERE pv.fixes > 0 ORDER BY pv.fixes DESC, pv.version DESC LIMIT 1) AS most_fixes_version,
            (SELECT pv.fixes::text FROM per_version pv
               WHERE pv.fixes > 0 ORDER BY pv.fixes DESC, pv.version DESC LIMIT 1) AS most_fixes_cnt,
            (SELECT pv.version FROM per_version pv
               WHERE pv.breaking > 0 ORDER BY pv.breaking DESC, pv.version DESC LIMIT 1) AS most_breaking_version,
            (SELECT pv.breaking::text FROM per_version pv
               WHERE pv.breaking > 0 ORDER BY pv.breaking DESC, pv.version DESC LIMIT 1) AS most_breaking_cnt,
            (SELECT pv.version FROM per_version pv
               WHERE pv.security > 0 ORDER BY pv.security DESC, pv.version DESC LIMIT 1) AS most_security_version,
            (SELECT pv.security::text FROM per_version pv
               WHERE pv.security > 0 ORDER BY pv.security DESC, pv.version DESC LIMIT 1) AS most_security_cnt,
            (SELECT pv.version FROM per_version pv
               WHERE pv.features > 0 ORDER BY pv.features DESC, pv.version DESC LIMIT 1) AS most_features_version,
            (SELECT pv.features::text FROM per_version pv
               WHERE pv.features > 0 ORDER BY pv.features DESC, pv.version DESC LIMIT 1) AS most_features_cnt,
            (SELECT pv.version FROM per_version pv
               WHERE pv.total > 0 ORDER BY pv.total DESC, pv.version DESC LIMIT 1) AS biggest_patch_version,
            (SELECT pv.total::text FROM per_version pv
               WHERE pv.total > 0 ORDER BY pv.total DESC, pv.version DESC LIMIT 1) AS biggest_patch_cnt
        `,
        [domainParam]
      ),
      // Longest-open known-issue (never fixed). Different shape — uses
      // issue_mentions; can't share the per-version CTE.
      query<{ issue_id: string; days: string; introduced_version: string }>(
        `
          WITH known AS (
            SELECT DISTINCT ON (im.issue_id) im.issue_id, ur.version, ur.release_date, im.area
            FROM issue_mentions im
            JOIN unity_releases ur ON ur.id = im.unity_release_id
            WHERE im.section = 'Known Issues'
            ORDER BY im.issue_id, ur.release_date ASC NULLS LAST
          ),
          fixed AS (
            SELECT DISTINCT im.issue_id
            FROM issue_mentions im
            WHERE im.section = 'Fixes'
          )
          SELECT k.issue_id,
            (EXTRACT(EPOCH FROM (now() - k.release_date)) / 86400)::text AS days,
            k.version AS introduced_version
          FROM known k
          LEFT JOIN fixed f ON f.issue_id = k.issue_id
          WHERE f.issue_id IS NULL AND k.release_date IS NOT NULL
          ${issueDomainCond}
          ORDER BY k.release_date ASC
          LIMIT 1
        `
      ),
      // Package with the most version bumps in the last 6 months —
      // different table entirely.
      query<{ name: string; cnt: string }>(
        `
          SELECT p.name, COUNT(*)::text AS cnt
          FROM package_versions pv
          JOIN packages p ON p.id = pv.package_id
          WHERE pv.published_at > now() - interval '6 months'
          GROUP BY p.name
          ORDER BY 2::int DESC
          LIMIT 1
        `
      ),
      // Fastest issue→fix turnaround. Min(days) where there IS a fix.
      query<{ issue_id: string; days: string; fixed_version: string }>(
        `
          WITH known AS (
            SELECT DISTINCT ON (im.issue_id) im.issue_id, ur.release_date, im.area
            FROM issue_mentions im
            JOIN unity_releases ur ON ur.id = im.unity_release_id
            WHERE im.section = 'Known Issues'
            ORDER BY im.issue_id, ur.release_date ASC NULLS LAST
          ),
          fix AS (
            SELECT DISTINCT ON (im.issue_id) im.issue_id, ur.version, ur.release_date
            FROM issue_mentions im
            JOIN unity_releases ur ON ur.id = im.unity_release_id
            WHERE im.section = 'Fixes'
            ORDER BY im.issue_id, ur.release_date ASC NULLS LAST
          )
          SELECT k.issue_id,
            (EXTRACT(EPOCH FROM (f.release_date - k.release_date)) / 86400)::text AS days,
            f.version AS fixed_version
          FROM known k
          JOIN fix f ON f.issue_id = k.issue_id
          WHERE k.release_date IS NOT NULL AND f.release_date IS NOT NULL
            AND f.release_date > k.release_date
          ${issueDomainCond}
          ORDER BY 2::numeric ASC
          LIMIT 1
        `
      ),
      // Longest gap between consecutive releases on the same minor_line
      //     in the last 12 months — "quietest stretch."
      query<{ minor_line: string; days: string; version: string }>(
        `
          WITH lagged AS (
            SELECT version, minor_line, release_date,
              LAG(release_date) OVER (PARTITION BY minor_line ORDER BY release_date ASC) AS prev_date
            FROM unity_releases
            WHERE release_date > now() - interval '12 months'
          )
          SELECT minor_line, version,
            (EXTRACT(EPOCH FROM (release_date - prev_date)) / 86400)::text AS days
          FROM lagged
          WHERE prev_date IS NOT NULL
          ORDER BY 3::numeric DESC
          LIMIT 1
        `
      )
    ]);

  const facts: VersionFact[] = [];
  const pv = perVersionFacts.rows[0];

  if (pv?.lowest_known_version && pv.lowest_known_cnt) {
    facts.push({
      id: "lowest-known",
      label: "Lowest known-issue count",
      value: `${pv.lowest_known_version} · ${pv.lowest_known_cnt} known issues`,
      formula: "min(count of impact_kind='known_issue') across releases in last 12 months",
      href: `/releases/${encodeURIComponent(pv.lowest_known_version)}`
    });
  }
  if (pv?.most_fixes_version && pv.most_fixes_cnt) {
    facts.push({
      id: "most-fixes",
      label: "Most fixes in a single patch",
      value: `${pv.most_fixes_version} · ${pv.most_fixes_cnt} fixes`,
      formula: "max(count of impact_kind='fix') per version",
      href: `/releases/${encodeURIComponent(pv.most_fixes_version)}`
    });
  }
  if (pv?.most_breaking_version && pv.most_breaking_cnt) {
    facts.push({
      id: "most-breaking",
      label: "Biggest breaking-change patch",
      value: `${pv.most_breaking_version} · ${pv.most_breaking_cnt} breaking`,
      formula: "max(count of impact_kind='breaking_change') per version",
      href: `/releases/${encodeURIComponent(pv.most_breaking_version)}`
    });
  }
  const v4 = longestOpen.rows[0];
  if (v4) {
    const days = Math.floor(Number(v4.days));
    facts.push({
      id: "longest-open",
      label: "Longest-living open known-issue",
      value: `${v4.issue_id} · ${days}d (since ${v4.introduced_version})`,
      formula: "now() − first known-issue mention, where the issue has no Fix mention",
      href: `/issues/${encodeURIComponent(v4.issue_id)}`
    });
  }
  if (pv?.most_security_version && pv.most_security_cnt && Number(pv.most_security_cnt) > 0) {
    facts.push({
      id: "most-security",
      label: "Most security-related fixes",
      value: `${pv.most_security_version} · ${pv.most_security_cnt} security fixes`,
      formula: "max(count of impact_kind='security_related_fix') per version",
      href: `/releases/${encodeURIComponent(pv.most_security_version)}`
    });
  }
  if (pv?.most_features_version && pv.most_features_cnt) {
    facts.push({
      id: "most-features",
      label: "Most new features in a patch",
      value: `${pv.most_features_version} · ${pv.most_features_cnt} features`,
      formula: "max(count of impact_kind='feature') per version",
      href: `/releases/${encodeURIComponent(pv.most_features_version)}`
    });
  }
  const v7 = mostChurnPackage.rows[0];
  if (v7) {
    facts.push({
      id: "most-churn-package",
      label: "Most package version churn (6 months)",
      value: `${v7.name} · ${v7.cnt} versions`,
      formula: "count of package_versions published in last 6 months, per package",
      href: `/packages`
    });
  }
  const v8 = fastestFix.rows[0];
  if (v8) {
    const days = Math.floor(Number(v8.days));
    facts.push({
      id: "fastest-fix",
      label: "Fastest issue→fix turnaround",
      value: `${v8.issue_id} · ${days}d (fixed ${v8.fixed_version})`,
      formula: "min(fix.release_date − known.release_date) across all issues",
      href: `/issues/${encodeURIComponent(v8.issue_id)}`
    });
  }
  if (pv?.biggest_patch_version && pv.biggest_patch_cnt) {
    facts.push({
      id: "biggest-patch",
      label: "Biggest release-note volume",
      value: `${pv.biggest_patch_version} · ${pv.biggest_patch_cnt} notes`,
      formula: "max(count of release_note_items) per version",
      href: `/releases/${encodeURIComponent(pv.biggest_patch_version)}`
    });
  }
  const v10 = quietestSinceRelease.rows[0];
  if (v10) {
    const days = Math.floor(Number(v10.days));
    facts.push({
      id: "longest-gap",
      label: "Longest gap between same-line patches",
      value: `${v10.minor_line} · ${days}d before ${v10.version}`,
      formula: "max(release_date − previous release_date) on the same minor_line, last 12 months",
      href: `/releases/${encodeURIComponent(v10.version)}`
    });
  }
  return facts;
}

/**
 * Load every release as a `ScoreInput` for the build-score engine.
 *
 * Per-release aggregates mirror `getVersionAggregates`, plus a window
 * function that returns the immediately-prior release's
 * `(fixes − known_issues)` on the same minor_line. This powers the
 * net-fix-delta sub-score; releases that are first on a line return
 * null and the scorer substitutes the cohort median.
 *
 * Reads all releases — caller is expected to score the whole population
 * at once (cheap at ~hundreds of rows; lets percentile-rank stay
 * consistent across views).
 */
export async function getScoreInputs(): Promise<ScoreInput[]> {
  return cachedScoreInputs();
}

const cachedScoreInputs = unstable_cache(
  async (): Promise<ScoreInput[]> => {
    return getScoreInputsImpl();
  },
  ["visualizer:getScoreInputs"],
  { revalidate: SCORE_DATA_TTL_SECONDS, tags: ["score-data"] }
);

async function getScoreInputsImpl(): Promise<ScoreInput[]> {
  const result = await query<{
    version: string;
    stream: string;
    minor_line: string;
    release_date: string | null;
    notes: string;
    fixes: string;
    known_issues: string;
    breaking: string;
    api_changes: string;
    blockers: string;
    mobile_blockers: string;
    prior_net_fix: string | null;
  }>(
    `
      WITH per_release AS (
        SELECT
          r.id,
          r.version,
          r.stream,
          r.minor_line,
          r.release_date,
          COUNT(n.id)                                                                AS notes,
          SUM(CASE WHEN n.impact_kind = 'fix'                  THEN 1 ELSE 0 END)    AS fixes,
          SUM(CASE WHEN n.impact_kind = 'known_issue'          THEN 1 ELSE 0 END)    AS known_issues,
          SUM(CASE WHEN n.impact_kind = 'breaking_change'      THEN 1 ELSE 0 END)    AS breaking,
          SUM(CASE WHEN n.impact_kind = 'api_change'           THEN 1 ELSE 0 END)    AS api_changes,
          SUM(CASE WHEN n.impact_kind = 'known_issue' AND n.risk_level = 'blocker'
                                                               THEN 1 ELSE 0 END)    AS blockers,
          SUM(CASE WHEN n.impact_kind = 'known_issue'
                    AND ('Android' = ANY(n.platforms) OR 'iOS' = ANY(n.platforms))
                                                               THEN 1 ELSE 0 END)    AS mobile_blockers
        FROM unity_releases r
        LEFT JOIN release_note_items n ON n.unity_release_id = r.id
        WHERE r.release_date IS NOT NULL
        GROUP BY r.id, r.version, r.stream, r.minor_line, r.release_date
      )
      SELECT
        version,
        stream,
        minor_line,
        release_date::text AS release_date,
        notes::text,
        fixes::text,
        known_issues::text,
        breaking::text,
        api_changes::text,
        blockers::text,
        mobile_blockers::text,
        LAG(fixes - known_issues) OVER (
          PARTITION BY minor_line
          ORDER BY release_date ASC, version ASC
        )::text AS prior_net_fix
      FROM per_release
      ORDER BY release_date DESC, version DESC
    `
  );

  return result.rows.map((row) => ({
    version: row.version,
    stream: row.stream,
    minorLine: row.minor_line,
    releaseDate: row.release_date,
    notes: Number(row.notes),
    fixes: Number(row.fixes),
    knownIssues: Number(row.known_issues),
    breaking: Number(row.breaking),
    apiChanges: Number(row.api_changes),
    blockers: Number(row.blockers),
    mobileBlockers: Number(row.mobile_blockers),
    priorNetFix: row.prior_net_fix == null ? null : Number(row.prior_net_fix)
  }));
}
