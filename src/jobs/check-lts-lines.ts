/**
 * Report drift between Unity's release API and the offline LTS fallback in
 * `src/lib/parsers/version.ts`.
 *
 * Ingestion no longer depends on that map - `resolveStream` prefers the
 * API's own `stream` per release, so a new LTS line (6000.7, or Unity 7's
 * first) is stored correctly with no code change. The map still backs the
 * pure/sync callers that have no network: inline version pills in release-note
 * bodies, and `poll-legacy-lts`'s choice of which legacy lines to crawl.
 *
 * This script keeps that fallback honest. Run it after an editor ingest, the
 * same way `check:packages` is run:
 *
 *   npm run check:lts
 *
 * Exit code:
 *   0 - fallback agrees with Unity
 *   1 - at least one line drifted (add/remove it in LTS_MINOR_LINES_BY_MAJOR)
 *
 * Read-only: hits the public release API and touches no database.
 */

import { RELEASE_API_BASE } from "@/lib/ingest/release-stream";
import { isLtsMinorLine, parseUnityVersion } from "@/lib/parsers/version";
import { isModernMajor, unityMajorLabel } from "@/lib/unity-generation";

// The API caps `limit` at 25.
const PAGE_LIMIT = 25;
// Streams that produce final builds. BETA/ALPHA are classified off the
// version channel, so they can't disagree with the fallback map.
const STREAMS = ["LTS", "SUPPORTED"] as const;
// Safety valve so a paging bug can't spin forever; ~4x today's LTS history.
const MAX_PAGES = 80;

type ApiListRelease = { version?: unknown; stream?: unknown };
type ApiListResponse = { total?: number; results?: ApiListRelease[] };

/** minorLine ("6000.7") -> the API stream Unity reports for that line. */
type LineStreams = Map<string, { major: number; minor: number; stream: string }>;

async function fetchPage(stream: string, offset: number): Promise<ApiListResponse> {
  const url = `${RELEASE_API_BASE}?limit=${PAGE_LIMIT}&offset=${offset}&stream=${stream}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Unity API ${stream} offset=${offset} -> HTTP ${res.status}`);
  }
  return (await res.json()) as ApiListResponse;
}

/**
 * Walk a stream and record which minor lines it contains. Only modern-scheme
 * majors are collected: the legacy year lines are a fixed, EOL set that we
 * choose to crawl deliberately, not something Unity's current API should be
 * allowed to expand.
 */
async function collectLines(stream: string, into: LineStreams): Promise<void> {
  let offset = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const body = await fetchPage(stream, offset);
    const results = body.results ?? [];
    if (results.length === 0) return;

    for (const release of results) {
      if (typeof release.version !== "string") continue;
      let parsed;
      try {
        parsed = parseUnityVersion(release.version);
      } catch {
        continue;
      }
      if (!isModernMajor(parsed.major)) continue;
      // Only final builds carry an LTS-vs-Supported distinction.
      if (parsed.suffixChannel !== "f") continue;
      into.set(parsed.minorLine, {
        major: parsed.major,
        minor: parsed.minor,
        stream
      });
    }

    offset += results.length;
    if (typeof body.total === "number" && offset >= body.total) return;
  }
  console.warn(`warning: stopped walking ${stream} after ${MAX_PAGES} pages`);
}

async function main() {
  const lines: LineStreams = new Map();
  for (const stream of STREAMS) {
    await collectLines(stream, lines);
  }

  if (lines.size === 0) {
    console.error("No modern-scheme releases returned by the Unity API - not concluding anything.");
    process.exitCode = 1;
    return;
  }

  const missing: string[] = [];
  const stale: string[] = [];

  // Numeric, newest-first - matching every other surface here. A bare .sort()
  // coerces the [key, value] tuples to strings, which puts 6000.10 before
  // 6000.2 and would scramble the report once a generation reaches a
  // double-digit minor or 6000/7000 coexist.
  const orderedLines = [...lines].sort(
    ([, a], [, b]) => b.major - a.major || b.minor - a.minor
  );

  for (const [minorLine, { major, minor, stream }] of orderedLines) {
    const apiSaysLts = stream === "LTS";
    const fallbackSaysLts = isLtsMinorLine(major, minor);
    if (apiSaysLts && !fallbackSaysLts) {
      missing.push(`  ${minorLine}  (${unityMajorLabel(major)}) - Unity says LTS, fallback says Update/Supported`);
    } else if (!apiSaysLts && fallbackSaysLts) {
      stale.push(`  ${minorLine}  (${unityMajorLabel(major)}) - fallback says LTS, Unity says ${stream}`);
    }
  }

  console.log(`Checked ${lines.size} modern minor line(s) across ${STREAMS.join(" + ")}.`);

  if (missing.length === 0 && stale.length === 0) {
    console.log("LTS_MINOR_LINES_BY_MAJOR agrees with Unity's release API.");
    return;
  }

  if (missing.length > 0) {
    console.log(`\nMissing from LTS_MINOR_LINES_BY_MAJOR (${missing.length}):`);
    console.log(missing.join("\n"));
  }
  if (stale.length > 0) {
    console.log(`\nNo longer LTS per Unity (${stale.length}):`);
    console.log(stale.join("\n"));
  }
  console.log("\nUpdate LTS_MINOR_LINES_BY_MAJOR in src/lib/parsers/version.ts.");
  console.log("Ingested rows are already correct - the API stream wins there.");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
