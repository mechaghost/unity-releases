/**
 * Discover packages that use Unity 6.4+ "unified versioning" by probing the
 * documentation site.
 *
 * Some core packages (com.unity.entities, com.unity.entities.graphics,
 * com.unity.collections, …) are renumbered to match the Editor version - e.g.
 * Entities ships as 6.4.0 in Unity 6.4 - and that build is only documented at
 * `docs.unity3d.com/Packages/<pkg>@<unity-minor>`. The registry keeps serving
 * the old line (1.4.x) for earlier Unity 6, so neither the registry poller nor
 * the editor-notes reconciliation sees the aligned version.
 *
 * For each tracked package we fetch the changelog at the latest Unity 6 stable
 * minors and, when the changelog's newest version actually matches that minor
 * (which also rules out docs that redirect to a package's own latest), record
 * it in `package_unified_versions`. Self-maintaining: a package that stops
 * being version-aligned has its row cleared.
 *
 * Usage: npm run ingest:package-docs
 */

import { fetchText } from "../lib/ingest/fetch";
import { query } from "../lib/db/client";
import { UNITY_OFFICIAL_PACKAGES } from "../lib/ingest/unity-packages";
import { parseDocsChangelogTopVersion, unityMinorOfVersion } from "../lib/parsers/package-docs";

const DOCS_BASE = "https://docs.unity3d.com/Packages";
// How many of the newest Unity 6 stable minors to probe. Four covers a
// package whose latest version-aligned build lags up to three Unity minors
// behind the current one, while still only adding a few cheap 404 probes per
// package. The job records the highest aligned minor it finds.
const TARGET_MINOR_COUNT = 4;

/** Latest N Unity 6 stable minors as docs-style "6.N", newest first. */
async function targetMinors(): Promise<string[]> {
  try {
    const { rows } = await query<{ minor: string }>(
      `
        SELECT DISTINCT split_part(version, '.', 2) AS minor
        FROM unity_releases
        WHERE version LIKE '6000.%' AND suffix_channel IN ('f', 'p')
      `
    );
    const minors = rows
      .map((r) => Number(r.minor))
      .filter((n) => Number.isInteger(n))
      .sort((a, b) => b - a)
      .slice(0, TARGET_MINOR_COUNT)
      .map((n) => `6.${n}`);
    return minors.length ? minors : ["6.4"];
  } catch {
    return ["6.4"];
  }
}

type Aligned = { unityMinor: string; version: string; date: string | null; url: string };

async function probePackage(pkg: string, minors: string[]): Promise<Aligned | null> {
  for (const minor of minors) {
    const url = `${DOCS_BASE}/${pkg}@${minor}/changelog/CHANGELOG.html`;
    try {
      const res = await fetchText(url);
      if (res.status !== 200) continue;
      const top = parseDocsChangelogTopVersion(res.text);
      // The newest changelog version must match the probed minor; otherwise
      // the docs redirected to the package's own latest (not version-aligned).
      if (top && unityMinorOfVersion(top.version) === minor) {
        return { unityMinor: minor, version: top.version, date: top.date, url };
      }
    } catch {
      // network hiccup - try the next minor
    }
  }
  return null;
}

async function main() {
  const minors = await targetMinors();
  console.log(JSON.stringify({ status: "starting", minors, packages: UNITY_OFFICIAL_PACKAGES.length }));

  let found = 0;
  for (const pkg of UNITY_OFFICIAL_PACKAGES) {
    const aligned = await probePackage(pkg, minors);
    if (aligned) {
      await query(
        `
          INSERT INTO package_unified_versions
            (package_name, unity_minor, aligned_version, released_on, doc_url, checked_at)
          VALUES ($1, $2, $3, $4, $5, now())
          ON CONFLICT (package_name) DO UPDATE SET
            unity_minor = EXCLUDED.unity_minor,
            aligned_version = EXCLUDED.aligned_version,
            released_on = EXCLUDED.released_on,
            doc_url = EXCLUDED.doc_url,
            checked_at = now()
        `,
        [pkg, aligned.unityMinor, aligned.version, aligned.date, aligned.url]
      );
      found += 1;
      console.log(JSON.stringify({ pkg, unityMinor: aligned.unityMinor, version: aligned.version }));
    } else {
      // Clear a stale row if this package is no longer version-aligned.
      await query(`DELETE FROM package_unified_versions WHERE package_name = $1`, [pkg]);
    }
  }

  console.log(JSON.stringify({ status: "done", found, of: UNITY_OFFICIAL_PACKAGES.length }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
