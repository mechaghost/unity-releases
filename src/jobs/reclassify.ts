/**
 * Backward-compatible entrypoint for the canonical release-note
 * reclassifier.
 *
 *   DATABASE_URL='...' npx tsx src/jobs/reclassify.ts
 */
import { runReleaseNoteReclassification } from "./reclassify-notes";

runReleaseNoteReclassification().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
