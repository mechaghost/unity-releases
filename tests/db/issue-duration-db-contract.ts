import assert from "node:assert/strict";
import pg from "pg";
import { scopedDatabaseUrl } from "../e2e/test-database";
import { ISSUE_DAYS_OPEN_SQL } from "../../src/lib/issue-duration";

const pool = new pg.Pool({ connectionString: scopedDatabaseUrl() });
async function duration(firstKnown: number | null, firstFix: number | null, latestKnown: number | null, latestFix: number | null, knownVersion = "6000.3.1f1", fixVersion = "6000.3.2f1", reopened: number[] = []) {
  const result = await pool.query(`
    WITH fk AS (SELECT 'UUM-TEST'::text issue_id, now() - $1::numeric * interval '1 day' release_date, $5::text version),
    ff AS (SELECT now() - $2::numeric * interval '1 day' release_date, $6::text version),
    lk AS (SELECT now() - $3::numeric * interval '1 day' release_date),
    lf AS (SELECT now() - $4::numeric * interval '1 day' release_date),
    unity_releases AS (SELECT row_number() OVER () id, now() - age * interval '1 day' release_date FROM unnest($7::numeric[]) age),
    issue_mentions AS (SELECT 'UUM-TEST'::text issue_id, 'Known Issues'::text section, id unity_release_id FROM unity_releases)
    SELECT (${ISSUE_DAYS_OPEN_SQL})::float8 days FROM fk CROSS JOIN ff CROSS JOIN lk CROSS JOIN lf
  `, [firstKnown, firstFix, latestKnown, latestFix, knownVersion, fixVersion, reopened]);
  return result.rows[0].days;
}
try {
  assert.equal(await duration(10, null, 2, null), 10, "never fixed: elapsed time since first known");
  assert.equal(await duration(10, 4, 8, 4), 6, "same-line closed interval");
  assert.equal(await duration(3, 4, 3, 2, "6000.7.0b6", "7000.0.0a11"), null, "earlier fix on another branch cannot produce a negative age");
  assert.equal(await duration(10, 4, 8, 4, "6000.0.1f1", "6000.3.1f1"), null, "later cross-line fix is also not a known duration");
  assert.equal(await duration(20, 15, 2, 10, "6000.3.1f1", "6000.3.2f1", [7, 2]), 7, "reopened: count from first known after last fix, not first fix or latest known");
  assert.equal(await duration(null, 4, null, 4), null, "no known start");
  assert.equal(await duration(-1, null, -1, null), null, "future known start");
  console.log("Issue duration database contract passed");
} finally { await pool.end(); }
