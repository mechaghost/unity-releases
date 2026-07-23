import { fetchText } from "../lib/ingest/fetch";
import { fetchApiStream, resolveIngestStream } from "../lib/ingest/release-stream";
import { normalizeReleaseForStorage } from "../lib/ingest/releases";
import {
  getStoredStream,
  recordSourceSnapshot,
  upsertReleaseBundle,
  withIngestionTransaction
} from "../lib/db/repositories";
import { extractReleasePageMetadata } from "../lib/parsers/release-page";

const EDITOR_SOURCES = [
  "https://unity.com/releases/editor/latest",
  "https://unity.com/releases/editor/beta",
  "https://unity.com/releases/editor/alpha"
];

async function main() {
  for (const url of EDITOR_SOURCES) {
    await withIngestionTransaction("editor_release", "poll-editor", async (client, runId) => {
      const fetched = await fetchText(url);
      const sourceSnapshotId = await recordSourceSnapshot(client, "editor_release_page", fetched);
      const scraped = extractReleasePageMetadata(fetched.text, fetched.finalUrl);

      // This job runs first in the cron and `ingest:backfill` skips releases
      // it has already stored, so whatever stream lands here is the one that
      // sticks. Ask Unity's release API rather than inferring from the version
      // number - that's what keeps a newly-announced LTS line (6000.7, and
      // Unity 7's first) correct with no code change. On API failure, keep the
      // stored value for a final build rather than overwrite it with the map's
      // guess (see resolveIngestStream). One cheap request per source.
      const apiStream = await fetchApiStream(scraped.version);
      const storedStream = apiStream ? null : await getStoredStream(client, scraped.version);
      const resolved = resolveIngestStream({ version: scraped.version, apiStream, storedStream });
      const metadata =
        resolved.stream === scraped.stream ? scraped : { ...scraped, stream: resolved.stream };

      const notes = metadata.releaseNotesUrl ? await fetchText(metadata.releaseNotesUrl) : null;
      const notesSnapshotId = notes
        ? await recordSourceSnapshot(client, "editor_release_notes", notes)
        : sourceSnapshotId;
      const bundle = normalizeReleaseForStorage({
        metadata,
        releaseNotesMarkdown: notes?.text ?? fetched.text,
        sourceSnapshotId: notesSnapshotId,
        ingestionRunId: runId,
        parserVersion: process.env.PARSER_VERSION ?? "2026-05-04"
      });
      await upsertReleaseBundle(client, bundle);
      console.log(JSON.stringify({
        source: url,
        finalUrl: fetched.finalUrl,
        version: metadata.version,
        stream: metadata.stream,
        streamSource: resolved.source
      }));
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
