export type ReleaseNoteSearchFilters = {
  q?: string;
  version?: string;
  minorLine?: string;
  stream?: string;
  section?: string;
  area?: string | string[];
  platform?: string | string[];
  impactKind?: string | string[];
  riskLevel?: string | string[];
  packageName?: string | string[];
  issueId?: string | string[];
  /** Only return notes that ship with at least one Issue Tracker link. */
  hasTracker?: boolean;
  /** Render-pipeline scope: any of "urp" | "hdrp" | "birp" | "agnostic". */
  pipelines?: string[];
  /** Drop low-signal rows: documentation, "other changes", and rows with
   *  no impact_kind tag. */
  hideNoise?: boolean;
  /** Bucket each row as Editor-only or Runtime-impacting based on its
   *  `area` value. Heuristic; see EDITOR_AREAS. Omit for "both". */
  editorScope?: "editor" | "runtime";
  /**
   * Regressions-only filter. When set to an ISO date string, drops any
   * row whose issue_ids array intersects with an issue that first
   * appeared in a release strictly *before* this date - i.e. only "new
   * since {date}" issues survive. Pass `range.fromDate` from /compare or
   * a release's own `release_date` from /releases/[version].
   */
  regressionsBefore?: string;
  limit?: number;
  offset?: number;
  order?: "newest" | "section" | "risk" | "source" | "area" | "issue";
};

/** Render-pipeline taxonomy for the "Render pipeline" filter chip. */
export const PIPELINE_DEFINITIONS: Record<
  string,
  { label: string; areas: string[]; packagePrefixes: string[] }
> = {
  urp: {
    label: "URP",
    areas: ["URP", "Universal RP"],
    packagePrefixes: ["com.unity.render-pipelines.universal"]
  },
  hdrp: {
    label: "HDRP",
    areas: ["HDRP", "High Definition RP"],
    packagePrefixes: ["com.unity.render-pipelines.high-definition"]
  },
  birp: {
    label: "Built-in RP",
    areas: ["Built-in RP", "BIRP"],
    packagePrefixes: []
  },
  agnostic: {
    label: "Pipeline-agnostic",
    areas: ["SRP Core", "Shaders", "Shadergraph", "VFX Graph", "Graphics"],
    packagePrefixes: [
      "com.unity.render-pipelines.core",
      "com.unity.shadergraph",
      "com.unity.visualeffectgraph"
    ]
  }
};

const NOISE_IMPACT_KINDS = ["documentation", "change"];

/**
 * Areas treated as Editor-only for the Editor-vs-Runtime filter. These
 * are the high-confidence picks from the actual Unity 6 release-note
 * data; ambiguous areas (Animation, Physics, Graphics, URP, etc.) are
 * treated as runtime so we avoid hiding things a runtime dev cares about.
 */
export const EDITOR_AREAS = [
  "Editor",
  "Inspector framework",
  "Inspector",
  "Build Pipeline",
  "Asset Pipeline",
  "Asset Importers",
  "Package Manager",
  "Profiler",
  "Scene/Game View",
  "Project Browser",
  "Hierarchy",
  "Search Window",
  "Test Tools",
  "Version Control",
  "Shader Compiler"
];

export type SqlValue = string | number | string[];

export type SqlQuery = {
  text: string;
  values: SqlValue[];
};

export function buildReleaseNoteSearchQuery(filters: ReleaseNoteSearchFilters): SqlQuery {
  const { where, values, add } = buildReleaseNoteWhere(filters);

  const limitParam = add(filters.limit ?? 100);
  const offsetParam = add(filters.offset ?? 0);

  const order = releaseNoteOrder(filters);

  return {
    text: `
      SELECT *, COUNT(*) OVER() AS total_count
      FROM release_note_items
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY ${order}
      LIMIT ${limitParam}
      OFFSET ${offsetParam}
    `.trim(),
    values
  };
}

function releaseNoteOrder(filters: ReleaseNoteSearchFilters): string {
  if (filters.q?.trim()) {
    return `ts_rank(search_vector, websearch_to_tsquery('english', $1)) DESC, release_date DESC NULLS LAST, source_order ASC`;
  }

  switch (filters.order) {
    case "section":
      return "section ASC, source_order ASC";
    case "risk":
      return `
        CASE risk_level
          WHEN 'blocker' THEN 0
          WHEN 'caution' THEN 1
          WHEN 'review' THEN 2
          ELSE 3
        END ASC,
        section ASC,
        source_order ASC
      `;
    case "area":
      return "area ASC NULLS LAST, section ASC, source_order ASC";
    case "issue":
      return "issue_text ASC, section ASC, source_order ASC";
    case "source":
      return "source_order ASC";
    case "newest":
    default:
      return "release_date DESC NULLS LAST, source_order ASC";
  }
}

export function buildReleaseNoteWhereForVersions(
  versions: string[],
  filters: ReleaseNoteSearchFilters,
  limit: number,
  offset: number = 0
): SqlQuery {
  const { where, values, add } = buildReleaseNoteWhere(filters);
  where.push(`version = ANY(${add(versions)})`);
  const limitParam = add(limit);
  const offsetClause = offset > 0 ? `OFFSET ${add(offset)}` : "";

  return {
    text: `
      SELECT *, COUNT(*) OVER() AS total_count
      FROM release_note_items
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY release_date DESC NULLS LAST, source_order ASC
      LIMIT ${limitParam}
      ${offsetClause}
    `.trim(),
    values
  };
}

function buildReleaseNoteWhere(filters: ReleaseNoteSearchFilters) {
  const where: string[] = [];
  const values: SqlValue[] = [];
  const add = (value: SqlValue) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (filters.q?.trim()) {
    const param = add(filters.q.trim());
    where.push(`search_vector @@ websearch_to_tsquery('english', ${param})`);
  }

  addEquals(where, add, "version", filters.version);
  addEquals(where, add, "minor_line", filters.minorLine);
  addEquals(where, add, "stream", filters.stream);
  addEquals(where, add, "section", filters.section);
  addEquals(where, add, "area", filters.area);
  addArrayContains(where, add, "platforms", filters.platform);
  addEquals(where, add, "impact_kind", filters.impactKind);
  addEquals(where, add, "risk_level", filters.riskLevel);
  addArrayContains(where, add, "package_names", filters.packageName);
  addArrayContains(where, add, "issue_ids", filters.issueId);

  if (filters.hasTracker) {
    // A "tracker link" is any non-empty issue_links_json array OR any populated
    // issue_ids array - the parser populates whichever it can.
    where.push(
      "((jsonb_typeof(issue_links_json) = 'array' AND jsonb_array_length(issue_links_json) > 0) OR cardinality(issue_ids) > 0)"
    );
  }

  if (filters.pipelines && filters.pipelines.length > 0) {
    // Render-pipeline scope: each selected pipeline contributes an OR clause
    // that matches by `area` value or by `package_names` prefix. Multiple
    // pipelines OR together - selecting URP and HDRP gives "either".
    const orParts: string[] = [];
    for (const id of filters.pipelines) {
      const def = PIPELINE_DEFINITIONS[id];
      if (!def) continue;
      const parts: string[] = [];
      if (def.areas.length > 0) {
        parts.push(`area = ANY(${add(def.areas)})`);
      }
      for (const prefix of def.packagePrefixes) {
        parts.push(`EXISTS (
          SELECT 1 FROM unnest(package_names) AS p WHERE p LIKE ${add(`${prefix}%`)}
        )`);
      }
      if (parts.length > 0) orParts.push(`(${parts.join(" OR ")})`);
    }
    if (orParts.length > 0) where.push(`(${orParts.join(" OR ")})`);
  }

  if (filters.hideNoise) {
    where.push(
      `(impact_kind IS NOT NULL AND impact_kind <> ALL(${add(NOISE_IMPACT_KINDS)}))`
    );
  }

  if (filters.editorScope === "editor") {
    where.push(`area = ANY(${add(EDITOR_AREAS)})`);
  } else if (filters.editorScope === "runtime") {
    where.push(`(area IS NULL OR area <> ALL(${add(EDITOR_AREAS)}))`);
  }

  if (filters.regressionsBefore) {
    // "Regressions only": drop rows whose issue_ids appear in any older
    // release-note item. Issues introduced *in or after* the boundary
    // date survive. Empty issue_ids never qualify (we can't prove they
    // weren't pre-existing) - they're dropped too.
    const dateParam = add(filters.regressionsBefore);
    where.push(`
      cardinality(issue_ids) > 0
      AND NOT EXISTS (
        SELECT 1
        FROM release_note_items prev
        WHERE prev.release_date < ${dateParam}
          AND prev.issue_ids && release_note_items.issue_ids
      )
    `);
  }

  return { where, values, add };
}

function addEquals(
  where: string[],
  add: (value: SqlValue) => string,
  column: string,
  value: string | string[] | undefined
) {
  if (Array.isArray(value)) {
    if (value.length === 0) return;
    if (value.length === 1) {
      where.push(`${column} = ${add(value[0])}`);
      return;
    }
    where.push(`${column} = ANY(${add(value)})`);
    return;
  }
  if (value) {
    where.push(`${column} = ${add(value)}`);
  }
}

function addArrayContains(
  where: string[],
  add: (value: SqlValue) => string,
  column: string,
  value: string | string[] | undefined
) {
  if (Array.isArray(value)) {
    if (value.length === 0) return;
    if (value.length === 1) {
      where.push(`${add(value[0])} = ANY(${column})`);
      return;
    }
    where.push(`${column} && ${add(value)}`);
    return;
  }
  if (value) {
    where.push(`${add(value)} = ANY(${column})`);
  }
}
