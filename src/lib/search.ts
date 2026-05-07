export type ReleaseNoteSearchFilters = {
  q?: string;
  version?: string;
  minorLine?: string;
  stream?: string;
  section?: string;
  area?: string;
  platform?: string | string[];
  impactKind?: string | string[];
  riskLevel?: string | string[];
  packageName?: string | string[];
  issueId?: string | string[];
  limit?: number;
  offset?: number;
  order?: "newest" | "section" | "risk" | "source" | "area" | "issue";
};

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
      SELECT *
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
