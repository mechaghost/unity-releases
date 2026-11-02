import type { PoolClient } from "pg";

// One short write lock avoids cross-issue deadlocks when a note links several
// reports. Never hold it while fetching HTTP. Metadata-only updates do not need it.
export async function lockIssueReportWrites(client: PoolClient) {
  await client.query("SELECT pg_advisory_xact_lock(187341, 1)");
}
