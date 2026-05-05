import { fetchText } from "../lib/ingest/fetch";
import { sha256 } from "../lib/ingest/hash";
import { normalizeReleaseForStorage } from "../lib/ingest/releases";
import { recordSourceSnapshot, upsertReleaseBundle, withIngestionTransaction } from "../lib/db/repositories";
import { extractApiReleaseMetadata, type ApiRelease, type ApiReleasesResponse } from "../lib/parsers/release-api";

const ALL_STREAMS = ["BETA", "ALPHA", "SUPPORTED", "LTS"] as const;
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

function isUnity6(release: ApiRelease): boolean {
  return release.version.startsWith("6000.");
}

async function ingestRelease(release: ApiRelease, stream: string): Promise<"created" | "skipped"> {
  const releaseNotesUrl = typeof release.releaseNotes?.url === "string" ? release.releaseNotes.url : null;
  if (!releaseNotesUrl) {
    console.log(JSON.stringify({ stream, version: release.version, skipped: "no release notes URL" }));
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

    const sixOnPage = page.results.filter(isUnity6);
    if (sixOnPage.length === 0) {
      console.log(JSON.stringify({ stream, offset, halt: "no Unity 6 on page; assuming older releases follow" }));
      break;
    }

    for (const release of sixOnPage) {
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

async function main() {
  const summary: Record<string, { ingested: number; skipped: number }> = {};
  for (const stream of STREAMS) {
    console.log(JSON.stringify({ stream, status: "starting" }));
    summary[stream] = await ingestStream(stream);
    console.log(JSON.stringify({ stream, status: "done", ...summary[stream] }));
  }
  console.log(JSON.stringify({ summary }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
