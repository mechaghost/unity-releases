import assert from "node:assert/strict";
import { getIssueLifespans } from "../../src/lib/visualizer";
import { getPool } from "../../src/lib/db/client";
import { scopedDatabaseUrl } from "../e2e/test-database";

// Never inherit the application's DATABASE_URL. The temporary tables below
// shadow fixture tables on one connection and disappear on rollback.
process.env.DATABASE_URL = scopedDatabaseUrl();
const pool = getPool();
const client = await pool.connect();
const originalQuery = pool.query;
// Run the real repository query on the connection holding our temporary data.
pool.query = client.query.bind(client) as typeof pool.query;

try {
  await client.query("BEGIN");
  await client.query(`
    CREATE TEMP TABLE unity_releases (
      id integer, version text, release_date timestamptz
    ) ON COMMIT DROP;
    CREATE TEMP TABLE issue_mentions (
      issue_id text, unity_release_id integer, section text, area text
    ) ON COMMIT DROP;
    CREATE TEMP TABLE release_note_items (
      issue_ids text[], risk_level text
    ) ON COMMIT DROP;

    INSERT INTO unity_releases VALUES
      (1, '6000.3.1f1', now() - interval '123 days'),
      (2, '6000.3.2f1', now() - interval '100 days'),
      (3, '6000.3.3f1', now() - interval '20 days'),
      (4, '6000.3.4f1', now() - interval '10 days'),
      (5, '6000.3.5f1', now() - interval '7 days'),
      (6, '6000.3.6f1', now() - interval '2 days'),
      (7, '7000.0.1f1', now() - interval '1 day');
    INSERT INTO issue_mentions VALUES
      ('OPEN123', 1, 'Known Issues', 'Editor'),
      ('OPEN20', 3, 'Known Issues', 'Editor'),
      ('CLOSED', 1, 'Known Issues', 'Editor'),
      ('CLOSED', 2, 'Fixes', 'Editor'),
      ('REOPENED', 1, 'Known Issues', 'Editor'),
      ('REOPENED', 4, 'Fixes', 'Editor'),
      ('REOPENED', 5, 'Known Issues', 'Editor'),
      ('REOPENED', 6, 'Known Issues', 'Editor'),
      ('CROSSLINE', 3, 'Known Issues', 'Editor'),
      ('CROSSLINE', 7, 'Fixes', 'Editor');
  `);

  const rows = await getIssueLifespans({});
  const byId = new Map(rows.map((row) => [row.issueId, row]));
  assert.deepEqual(
    rows.map((row) => row.issueId),
    ["OPEN123", "CLOSED", "OPEN20", "REOPENED", "CROSSLINE"],
    "Durations sort numerically, with unknown intervals last"
  );
  assert.equal(byId.get("CLOSED")!.daysOpen, 23, "Same-line closed interval");
  assert.equal(byId.get("CROSSLINE")!.daysOpen, null, "Cross-line duration is unknown");
  assert.equal(byId.get("REOPENED")!.daysOpen, 7, "Age starts at first known mention after the fix");
  assert.equal(byId.get("REOPENED")!.periodStartVersion, "6000.3.5f1");
  assert.equal(byId.get("REOPENED")!.fixedDate, null, "Reopened bars end at today");
  assert.deepEqual(
    (await getIssueLifespans({ onlyOpen: true })).map((row) => row.issueId),
    ["OPEN123", "OPEN20", "REOPENED"],
    "Open-only includes reopened issues"
  );
  console.log("Visualizer duration database contract passed");
} finally {
  await client.query("ROLLBACK");
  pool.query = originalQuery;
  client.release();
  await pool.end();
}
