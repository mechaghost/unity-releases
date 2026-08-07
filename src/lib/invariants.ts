/**
 * Post-ingest data invariants.
 *
 * Every parser bug this project has shipped shared one trait: it stored a
 * value that LOOKED fine. "Text 1" as a resource title, `Madbox achieves \`,
 * a `$3a` reference token, `10.1.0 &#x2192; 10.1.1`, an
 * `editor_package_versions` table holding 9,981 rows of a single change
 * kind. Nothing threw, nothing logged, and each sat in production for
 * months until a human happened to look at the right row.
 *
 * These checks turn that class of failure into a red cron run on the day
 * it lands. They assert properties of the STORED data rather than of any
 * one parser, so they keep working when a parser is rewritten - and they
 * catch upstream format drift that no unit test can anticipate.
 *
 * Severity:
 *   "error" - corrupt data users can see. Fails the run (non-zero exit).
 *   "warn"  - a smell worth a human look; reported, doesn't fail.
 *
 * Each check is a COUNT of offending rows plus a sample, so a failure
 * message is immediately actionable.
 */

export type InvariantSeverity = "error" | "warn";

export type Invariant = {
  name: string;
  severity: InvariantSeverity;
  /** What a non-zero count means, and what usually causes it. */
  describe: string;
  /** Must return rows shaped `{ n: <count>, sample: <text|null> }`. */
  sql: string;
  /** Offending-row count allowed before the check trips. Default 0. */
  threshold?: number;
};

/**
 * Where a column's text came from, which decides what counts as corrupt.
 *
 * "scraped"     - we extracted it from markup ourselves (resources).
 *                 A backslash or stray whitespace there is an escape
 *                 artefact, because Unity's CMS titles never contain one.
 * "passthrough" - handed to us as JSON by an API and stored verbatim
 *                 (Discourse topic titles, GitHub descriptions). These
 *                 are user-written, so a backslash is legitimate content
 *                 - `Assets\PlayerController.cs` and `External\libpng`
 *                 are real forum/repo text, not parser damage. Only the
 *                 checks that stay meaningful are applied.
 */
type TextOrigin = "scraped" | "passthrough";

/**
 * Display text that reached the DB with an escape artefact still in it.
 * Applied to the columns that render directly on a page.
 */
function corruptTextChecks(
  table: string,
  columns: string[],
  severity: InvariantSeverity = "error",
  origin: TextOrigin = "scraped"
): Invariant[] {
  const anyCol = (pred: (c: string) => string) =>
    columns.map(pred).join(" OR ");
  const sampleCol = columns[0];
  const checks: Invariant[] = [
    {
      name: `${table}: no undecoded HTML entities`,
      severity,
      describe:
        "A named or numeric entity survived into stored display text - the decoder missed a form (e.g. only named entities handled, or a double-encoded value).",
      sql: `
        SELECT COUNT(*)::int AS n,
               MIN(${sampleCol}) FILTER (WHERE ${anyCol((c) => `${c} ~ '&(amp|lt|gt|quot|nbsp|#[0-9]+|#x[0-9a-fA-F]+);'`)}) AS sample
        FROM ${table}
        WHERE ${anyCol((c) => `${c} ~ '&(amp|lt|gt|quot|nbsp|#[0-9]+|#x[0-9a-fA-F]+);'`)}
      `
    },
  ];

  // Only meaningful for text we extracted ourselves - see TextOrigin.
  if (origin === "scraped") {
    checks.push({
      name: `${table}: no stray backslash escapes`,
      severity,
      describe:
        "A literal backslash in display text means an escape layer wasn't peeled (a truncated value like 'Madbox achieves \\' or an encoded newline rendering as \\n).",
      sql: `
        SELECT COUNT(*)::int AS n,
               MIN(${sampleCol}) FILTER (WHERE ${anyCol((c) => `strpos(${c}, chr(92)) > 0`)}) AS sample
        FROM ${table}
        WHERE ${anyCol((c) => `strpos(${c}, chr(92)) > 0`)}
      `
    });
    checks.push({
      name: `${table}: display text is trimmed`,
      severity: "warn",
      describe:
        "Leading/trailing whitespace usually means the value was sliced out of markup rather than decoded.",
      sql: `
        SELECT COUNT(*)::int AS n,
               MIN(${sampleCol}) FILTER (WHERE ${anyCol((c) => `${c} <> btrim(${c})`)}) AS sample
        FROM ${table}
        WHERE ${anyCol((c) => `${c} <> btrim(${c})`)}
      `
    });
  }

  checks.push({
      name: `${table}: no framework placeholder tokens`,
      severity,
      describe:
        "A value equal to a Next.js Flight reference ($3a) or similar placeholder - the field held a pointer, not the text.",
      sql: `
        SELECT COUNT(*)::int AS n,
               MIN(${sampleCol}) FILTER (WHERE ${anyCol((c) => `${c} ~ '^[$][0-9a-zA-Z.$]{0,24}$'`)}) AS sample
        FROM ${table}
        WHERE ${anyCol((c) => `${c} ~ '^[$][0-9a-zA-Z.$]{0,24}$'`)}
      `
  });

  return checks;
}

/**
 * Titles that are obviously a mis-grab: a component/section name rather
 * than content. This is the literal "Text 1" signature.
 */
function decoyTitleCheck(table: string, column: string): Invariant {
  return {
    name: `${table}.${column}: no decoy values`,
    severity: "error",
    describe:
      "The value matches a generic component/section name, which is what a fall-through match produces when the real field failed to parse (the 'Text 1' bug).",
    sql: `
      SELECT COUNT(*)::int AS n, MIN(${column}) AS sample
      FROM ${table}
      WHERE lower(btrim(${column})) IN (
        'text', 'text 1', 'text 2', 'intro', 'title', 'heading', 'body',
        'description', 'label', 'name', 'seo', 'untitled', 'null',
        'undefined', 'nan', 'none', 'tbd', 'lorem ipsum'
      )
    `
  };
}

export const INVARIANTS: Invariant[] = [
  // ---- resources -------------------------------------------------
  ...corruptTextChecks("resources", ["title", "summary"]),
  decoyTitleCheck("resources", "title"),
  {
    name: "resources: parsed via the authoritative Flight reader",
    severity: "error",
    describe:
      "Rows produced by the legacy string-scanner fallback. Non-zero means Next.js changed how it inlines the payload and the resource parser has silently degraded to the brittle path.",
    sql: `
      SELECT COUNT(*)::int AS n, MIN(slug) AS sample
      FROM resources
      WHERE raw_metadata_json->>'parserPath' IS DISTINCT FROM 'flight'
    `,
    // Rows ingested before parserPath existed have no value; allow the
    // current corpus size until one forced re-crawl has run everywhere.
    threshold: 800
  },
  {
    name: "resources: titles are not slug fallbacks",
    severity: "warn",
    describe:
      "title == slug means the parser found no seo title and fell back. A few are genuine; a spike means the payload shape moved.",
    sql: `
      SELECT COUNT(*)::int AS n, MIN(slug) AS sample FROM resources WHERE title = slug
    `,
    threshold: 20
  },

  // ---- release notes ---------------------------------------------
  // NOTE: release_note_items.body deliberately stores upstream text
  // verbatim and is decoded at render by cleanReleaseNoteText, so an
  // entity there is not corruption. What IS checked is the release
  // metadata that renders raw.
  ...corruptTextChecks("unity_releases", ["version"]),
  {
    name: "editor_package_versions: change kinds are not degenerate",
    severity: "warn",
    describe:
      "Only one distinct change_kind across the whole table means a parser branch is dead code. This is exactly how 'added'/'removed' rows were lost: 9,981 rows were all 'updated' and nothing complained.",
    sql: `
      SELECT CASE WHEN COUNT(DISTINCT change_kind) <= 1 AND COUNT(*) > 100 THEN 1 ELSE 0 END::int AS n,
             MIN(change_kind) AS sample
      FROM editor_package_versions
    `
  },

  // ---- packages ---------------------------------------------------
  {
    name: "package_unified_versions: no pre-unified-era rows",
    severity: "error",
    describe:
      "Unified versioning began with Unity 6.4 (2025). An older date means a coincidental legacy version line (e.g. the SRP 6.5.x line from 2019) was mistaken for a version-aligned build.",
    sql: `
      SELECT COUNT(*)::int AS n, MIN(package_name) AS sample
      FROM package_unified_versions
      WHERE released_on < DATE '2025-01-01'
    `
  },
  ...corruptTextChecks("packages", ["display_name"], "warn", "passthrough"),

  // ---- discussions ------------------------------------------------
  ...corruptTextChecks("discourse_posts", ["topic_title"], "warn", "passthrough"),
  decoyTitleCheck("discourse_posts", "topic_title"),

  // ---- github -----------------------------------------------------
  ...corruptTextChecks("github_repos", ["description"], "warn", "passthrough"),

  // ---- cross-cutting ----------------------------------------------
  {
    name: "ingestion_runs: no runs stuck mid-flight",
    severity: "warn",
    describe:
      "A run left in 'running' for over a day means a job died without finalizing - its data may be partial.",
    sql: `
      SELECT COUNT(*)::int AS n, MIN(job_name) AS sample
      FROM ingestion_runs
      WHERE status = 'running' AND started_at < now() - INTERVAL '1 day'
    `
  }
];
