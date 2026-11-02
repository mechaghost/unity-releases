/** Optional: fetch the real public customer report into the local test schema. */
import assert from "node:assert/strict";
import { scopedDatabaseUrl } from "../e2e/test-database";
const databaseUrl=scopedDatabaseUrl();
assert(["127.0.0.1","localhost"].includes(new URL(databaseUrl).hostname),"Live smoke requires a local test database");
process.env.DATABASE_URL=databaseUrl;
process.env.ISSUE_REPORT_SEARCH_ENABLED="true";
const {getPool,query}=await import("../../src/lib/db/client");
const {collectIssueReports}=await import("../../src/jobs/poll-issue-reports");
const {searchReleaseNotes}=await import("../../src/lib/db/repositories");
try {
  assert.equal((await query("SELECT count(*)::int AS n FROM issue_mentions WHERE issue_id='UUM-145761'")).rows[0].n>0,true,"Run the report DB contract first");
  await query("UPDATE issue_report_collector_state SET cooldown_until=NULL WHERE singleton");
  await query("UPDATE issue_reports SET next_attempt_at=now(),canonical_url=NULL WHERE issue_id='UUM-145761'");
  const summary=await collectIssueReports({issueId:"UUM-145761"});
  assert(!('skipped' in summary));
  const rows=await searchReleaseNotes({q:"linux file descriptors",version:"6000.3.23f1"});
  const report=rows.flatMap(row=>row.issueReports).find(report=>report.issueId==='UUM-145761');
  assert(report.title.includes('Linux Editor'));
  assert(report.url.startsWith('https://issuetracker.unity.com/issues/23181/'));
  console.log(JSON.stringify({liveReport:report.url,matchingNotes:rows.length,result:"PASS"}));
} finally {await getPool().end();}
