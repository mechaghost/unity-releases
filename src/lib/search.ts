export type ReleaseNoteSearchFilters = {
  q?: string;
  version?: string;
  minorLine?: string;
  stream?: string;
  section?: string;
  area?: string;
  platform?: string;
  impactKind?: string;
  riskLevel?: string;
  packageName?: string;
  issueId?: string;
  limit?: number;
  offset?: number;
};

export type SqlQuery = {
  text: string;
  values: Array<string | number>;
};

export function buildReleaseNoteSearchQuery(filters: ReleaseNoteSearchFilters): SqlQuery {
  const where: string[] = [];
  const values: Array<string | number> = [];
  const add = (value: string | number) => {
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

  const limitParam = add(filters.limit ?? 100);
  const offsetParam = add(filters.offset ?? 0);

  const rank = filters.q?.trim()
    ? `ts_rank(search_vector, websearch_to_tsquery('english', $1)) DESC,`
    : "";

  return {
    text: `
      SELECT *
      FROM release_note_items
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY ${rank} release_date DESC NULLS LAST, source_order ASC
      LIMIT ${limitParam}
      OFFSET ${offsetParam}
    `.trim(),
    values
  };
}

function addEquals(
  where: string[],
  add: (value: string | number) => string,
  column: string,
  value: string | undefined
) {
  if (value) {
    where.push(`${column} = ${add(value)}`);
  }
}

function addArrayContains(
  where: string[],
  add: (value: string | number) => string,
  column: string,
  value: string | undefined
) {
  if (value) {
    where.push(`${add(value)} = ANY(${column})`);
  }
}
