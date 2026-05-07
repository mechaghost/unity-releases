/**
 * Surface `com.unity.*` packages that Unity mentions in editor release
 * notes but that we don't track in `UNITY_OFFICIAL_PACKAGES`. Run after
 * each editor ingest to catch new packages Unity ships before they
 * silently disappear from /packages.
 *
 * Usage:
 *   npm run check:packages
 *
 * Exit code:
 *   0 — nothing missing
 *   1 — at least one untracked package surfaced
 *
 * The script is read-only and prints a sortable list grouped by mention
 * count so it's obvious which gaps actually matter.
 */

import { query } from "@/lib/db/client";
import { UNITY_OFFICIAL_PACKAGES } from "@/lib/ingest/unity-packages";

const MIN_MENTIONS_TO_REPORT = 1;

/**
 * Patterns that aren't real registry packages and would create noise in
 * the report:
 * - `com.unity.modules.*` are built-in editor modules, not registry
 *   entries — they ship with Unity itself and have no /packages page.
 */
const IGNORE_PREFIXES = ["com.unity.modules."];

type Row = { pkg: string; mentions: string; in_versions: string };

async function main() {
  const tracked = new Set(UNITY_OFFICIAL_PACKAGES);

  const result = await query<Row>(
    `
      SELECT
        pkg,
        COUNT(*)::text AS mentions,
        COUNT(DISTINCT version)::text AS in_versions
      FROM release_note_items, unnest(package_names) AS pkg
      WHERE pkg LIKE 'com.unity.%'
      GROUP BY pkg
      ORDER BY COUNT(*) DESC, pkg
    `
  );

  const missing = result.rows.filter(
    (r) =>
      !tracked.has(r.pkg) &&
      Number(r.mentions) >= MIN_MENTIONS_TO_REPORT &&
      !IGNORE_PREFIXES.some((prefix) => r.pkg.startsWith(prefix))
  );

  if (missing.length === 0) {
    console.log(
      `✓ All ${tracked.size} curated packages cover every com.unity.* mention in the release-note index.`
    );
    process.exit(0);
  }

  const colWidth = Math.max(...missing.map((r) => r.pkg.length), 24);

  console.log(
    `Found ${missing.length} com.unity.* package(s) mentioned in release notes but not tracked:\n`
  );
  console.log(
    `${"package".padEnd(colWidth)}  mentions  in_versions`
  );
  console.log(
    `${"-".repeat(colWidth)}  --------  -----------`
  );
  for (const row of missing) {
    console.log(
      `${row.pkg.padEnd(colWidth)}  ${row.mentions.padStart(8)}  ${row.in_versions.padStart(11)}`
    );
  }
  console.log(
    `\nAdd the entries you want to keep tracking to UNITY_OFFICIAL_PACKAGES in src/lib/ingest/unity-packages.ts and re-run npm run ingest:packages.`
  );
  process.exit(1);
}

main().catch((err) => {
  console.error("check:packages failed:", err);
  process.exit(2);
});
