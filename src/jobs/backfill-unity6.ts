import { fetchText } from "../lib/ingest/fetch";
import { sha256 } from "../lib/ingest/hash";
import { normalizeReleaseForStorage } from "../lib/ingest/releases";
import { recordSourceSnapshot, upsertReleaseBundle, withIngestionTransaction } from "../lib/db/repositories";
import { query } from "../lib/db/client";
import { extractApiReleaseMetadata, type ApiRelease, type ApiReleasesResponse } from "../lib/parsers/release-api";
import { parseUnityVersion } from "../lib/parsers/version";
import { isModernMajor } from "../lib/unity-generation";

// LTS first: that stream holds the 6000.0.x / 6000.3.x history (the
// frozen-package baseline and the bulk of editor->package mappings), which
// is the most valuable data and the slowest to walk. SUPPORTED (6000.1/2/4)
// and the prerelease streams follow. Per-release skip (below) makes a run
// resumable, so a max-runtime kill mid-walk just continues next time.
const ALL_STREAMS = ["LTS", "SUPPORTED", "BETA", "ALPHA"] as const;
const STREAMS = process.env.BACKFILL_STREAMS
  ? process.env.BACKFILL_STREAMS.split(",").map((s) => s.trim()).filter(Boolean)
  : ALL_STREAMS;
const PAGE_LIMIT = 25;
const API_BASE = "https://services.api.unity.com/unity/editor/release/v1/releases";
const PARSER_VERSION = process.env.PARSER_VERSION ?? "2026-05-04";

async function fetchReleasePage(stream: string, offset: number): Promise<ApiReleasesResponse> {
  const url = `${API_BASE}?limit=${PAGE_LIMIT}&offset=${offset}&stream=${stream}`;
  const fetched = await fetchText(url);
  if (fetched.status >= 400) {
    throw new Error(`Unity API ${stream} offset=${offset} -> HTTP ${fetched.status}: ${fetched.text.slice(0, 200)}`);
  }
  return JSON.parse(fetched.text) as ApiReleasesResponse;
}

/**
 * In scope for the walk: Unity 6 and every generation after it (6000.x,
 * 7000.x, …). Deliberately *not* `startsWith("6000.")` - the halt below
 * stops the entire stream walk on the first page with no matches, so a
 * Unity-6-only test would abort at page 0 the moment Unity 7 tops the
 * list, silently freezing the backfill for every generation.
 */
export function isInScope(release: ApiRelease): boolean {
  try {
    return isModernMajor(parseUnityVersion(release.version).major);
  } catch {
    return false;
  }
}

// A release is already done if we've stored it with the current parser
// version - its notes (and editor_package_versions) are current. Skipping it
// without fetching notes is what makes the backfill cheap to re-run and
// resumable after a max-runtime kill. A PARSER_VERSION bump (or
// FORCE_BACKFILL=1) re-walks everything.
async function releaseAlreadyIngested(version: string): Promise<boolean> {
  try {
    const { rows } = await query(
      `SELECT 1 FROM unity_releases WHERE version = $1 AND parser_version = $2 LIMIT 1`,
      [version, PARSER_VERSION]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function ingestRelease(release: ApiRelease, stream: string): Promise<"created" | "skipped"> {
  const releaseNotesUrl = typeof release.releaseNotes?.url === "string" ? release.releaseNotes.url : null;
  if (!releaseNotesUrl) {
    console.log(JSON.stringify({ stream, version: release.version, skipped: "no release notes URL" }));
    return "skipped";
  }

  if (!process.env.FORCE_BACKFILL && (await releaseAlreadyIngested(release.version))) {
    return "skipped";
  }

  await withIngestionTransaction("editor_release", "backfill-unity6", async (client, runId) => {
    const apiText = JSON.stringify(release);
    const apiSnapshotUrl = `${API_BASE}?version=${release.version}`;
    const apiSnapshotId = await recordSourceSnapshot(client, "editor_release_api", {
      url: apiSnapshotUrl,
      finalUrl: apiSnapshotUrl,
      status: 200,
      etag: null,
      lastModified: null,
      text: apiText,
      sha256: sha256(apiText)
    });

    const notes = await fetchText(releaseNotesUrl);
    const notesSnapshotId = await recordSourceSnapshot(client, "editor_release_notes", notes);

    const metadata = extractApiReleaseMetadata(release);
    const bundle = normalizeReleaseForStorage({
      metadata,
      releaseNotesMarkdown: notes.text,
      sourceSnapshotId: notesSnapshotId,
      ingestionRunId: runId,
      parserVersion: PARSER_VERSION
    });
    await upsertReleaseBundle(client, bundle);
    console.log(JSON.stringify({
      stream,
      version: release.version,
      apiSnapshot: apiSnapshotId,
      notesSnapshot: notesSnapshotId,
      noteItems: bundle.noteItems.length
    }));
  });

  return "created";
}

async function ingestStream(stream: string): Promise<{ ingested: number; skipped: number }> {
  let offset = 0;
  let ingested = 0;
  let skipped = 0;

  while (true) {
    const page = await fetchReleasePage(stream, offset);
    if (!page.results.length) break;

    // Pages come back newest-first, so the first page with nothing in scope
    // is the legacy-year boundary (2023.x and older) - everything past it is
    // older still. Unity 7 sits *above* Unity 6 in this ordering, so the walk
    // now spans both generations before halting.
    const inScope = page.results.filter(isInScope);
    if (inScope.length === 0) {
      console.log(JSON.stringify({
        stream,
        offset,
        halt: "no Unity 6+ releases on page; assuming older releases follow"
      }));
      break;
    }

    for (const release of inScope) {
      try {
        const outcome = await ingestRelease(release, stream);
        if (outcome === "created") ingested += 1;
        else skipped += 1;
      } catch (error) {
        console.error(JSON.stringify({
          stream,
          version: release.version,
          error: error instanceof Error ? error.message : String(error)
        }));
        skipped += 1;
      }
    }

    offset += page.results.length;
    if (offset >= page.total) break;
  }

  return { ingested, skipped };
}

// No global "already done" guard: the per-release `releaseAlreadyIngested`
// skip makes a full pass cheap once the history is seeded (it just pages the
// release lists and runs one existence check per release - no note fetches),
// and crucially it can't prematurely declare completion the way a count
// threshold could. A killed run simply resumes from the missing releases on
// the next cron.
async function main() {
  const summary: Record<string, { ingested: number; skipped: number }> = {};
  for (const stream of STREAMS) {
    console.log(JSON.stringify({ stream, status: "starting" }));
    summary[stream] = await ingestStream(stream);
    console.log(JSON.stringify({ stream, status: "done", ...summary[stream] }));
  }
  console.log(JSON.stringify({ summary }));
}

// Same guard as poll-all.ts: this file is a cron entrypoint, so just run -
// but stay inert when a test imports it for the scope predicate.
const isDirectRun = process.argv[1] && process.argv[1].endsWith("backfill-unity6.ts");
if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
