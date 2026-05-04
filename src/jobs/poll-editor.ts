import { fetchText } from "../lib/ingest/fetch";
import { normalizeReleaseForStorage } from "../lib/ingest/releases";
import { recordSourceSnapshot, upsertReleaseBundle, withIngestionTransaction } from "../lib/db/repositories";
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
      const metadata = extractReleasePageMetadata(fetched.text, fetched.finalUrl);
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
      console.log(JSON.stringify({ source: url, finalUrl: fetched.finalUrl, version: metadata.version }));
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
