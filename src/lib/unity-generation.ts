/**
 * Unity's editor version scheme, expressed as arithmetic instead of constants.
 *
 * Unity 6 replaced the old year-based major (2019.x … 2023.x) with
 * `<generation> * 1000`: Unity 6 ships as `6000.x`, so Unity 6.7 is `6000.7`
 * and Unity 7 will be `7000.x`. Deriving that instead of hardcoding `6000`
 * means a new generation - or a new minor line inside one - needs no code
 * edit here.
 *
 * Edge-safe and dependency-free (pure number/string work), so client
 * components, route handlers, and ingest jobs can all share it.
 */

/** First major of the modern scheme. Anything below is the legacy year scheme. */
export const MODERN_MIN_MAJOR = 6000;

/** Majors advance a full 1000 per Unity generation (6000 → 7000 → …). */
const GENERATION_STRIDE = 1000;

/** True for Unity 6 and every generation after it; false for 2019–2023. */
export function isModernMajor(major: number): boolean {
  return Number.isFinite(major) && major >= MODERN_MIN_MAJOR;
}

/** `6000` → 6, `7000` → 7. Null for legacy year majors, which have no generation. */
export function unityGeneration(major: number): number | null {
  return isModernMajor(major) ? Math.floor(major / GENERATION_STRIDE) : null;
}

/**
 * Display label for a major line: `6000` → "Unity 6", `7000` → "Unity 7",
 * `2022` → "Unity 2022 LTS". Legacy majors keep the "LTS" suffix because
 * those are the only pre-Unity-6 lines we track (see poll-legacy-lts).
 */
export function unityMajorLabel(major: number): string {
  const generation = unityGeneration(major);
  return generation === null ? `Unity ${major} LTS` : `Unity ${generation}`;
}

/**
 * The marketing minor Unity uses in docs URLs and release naming:
 * (6000, 7) → "6.7", (7000, 0) → "7.0". Null for legacy majors, which
 * already *are* their own marketing version (2022.3 is just "2022.3").
 */
export function marketingMinor(major: number, minor: number): string | null {
  const generation = unityGeneration(major);
  return generation === null || !Number.isFinite(minor) ? null : `${generation}.${minor}`;
}

/** "6000.4.11f1" → "6.4"; "7000.1.0f1" → "7.1"; legacy or unparseable → null. */
export function marketingMinorOfEditor(editorVersion: string | null | undefined): string | null {
  const match = editorVersion?.trim().match(/^(\d+)\.(\d+)\./);
  return match ? marketingMinor(Number(match[1]), Number(match[2])) : null;
}

/**
 * SQL predicate selecting modern-scheme editor rows, replacing the
 * `version LIKE '6000.%'` filters that used to pin queries to Unity 6.
 *
 * `CASE` is used rather than a bare `AND` guard because Postgres does not
 * promise evaluation order for `AND`, so an unguarded `::int` cast could
 * abort the whole query on one malformed `version`. `CASE` short-circuits.
 *
 * `versionColumn` is interpolated directly - callers must pass a trusted
 * column reference (a literal in our source), never user input.
 */
export function modernMajorSql(versionColumn: string): string {
  return (
    `(CASE WHEN ${versionColumn} ~ '^[0-9]+\\.'` +
    ` THEN split_part(${versionColumn}, '.', 1)::int ELSE 0 END) >= ${MODERN_MIN_MAJOR}`
  );
}
