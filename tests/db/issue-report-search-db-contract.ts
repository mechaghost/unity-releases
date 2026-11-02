import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { setupE2eDatabase } from "../e2e/setup-db";
import { scopedDatabaseUrl } from "../e2e/test-database";
import { parseIssueReport } from "../../src/lib/parsers/issue-report";
import { parseCanonicalQuery, candidateQuery, compileFieldMatch, serializeQuery, validatePhraseSpans } from "../../src/lib/issue-reports/query";

async function main() {
  await setupE2eDatabase();
  process.env.DATABASE_URL = scopedDatabaseUrl();
  const { getPool, query } = await import("../../src/lib/db/client");
  const { withReportWrite, saveIssueReport } = await import("../../src/lib/issue-reports/repository");
  const { searchReleaseNotes, searchReleaseNotesInRange, upsertReleaseBundle, withIngestionTransaction, recordSourceSnapshot } = await import("../../src/lib/db/repositories");
  const { normalizeReleaseForStorage } = await import("../../src/lib/ingest/releases");
  const { repairReportVectors, buildReportSearchIndex } = await import("../../src/jobs/repair-issue-report-search");
  const { collectIssueReports } = await import("../../src/jobs/poll-issue-reports");
  const { issueIdResolver } = await import("../../src/lib/parsers/issue-report");
  const report = parseIssueReport(readFileSync("tests/fixtures/issue-reports/customer.html", "utf8"), "UUM-145761");
  const url = "https://issuetracker.unity.com/issues/23181/example";
  const snapshotId = Number((await query("INSERT INTO source_snapshots(source_type,source_url,content_sha256,content_text) VALUES ('test',$1,'test','fixture') RETURNING id", [url])).rows[0].id);
  const input = {
    metadata: { version: "6000.3.23f1", releaseDate: "2026-08-26", stream: "LTS" as const,
      shortRevision: "09d2ecc7fb28", changeset: "09d2ecc7fb28", releasePageUrl: "https://unity.com/releases/editor/whats-new/6000.3.23f1", releaseNotesUrl: "https://example.com/notes.md",
      unityHubDeepLink: "unityhub://6000.3.23f1/09d2ecc7fb28",
      artifacts: [{ platform: "LINUX", architecture: "X86_64", category: "EDITOR", name: "Unity Editor", url: "https://example.com/editor.tar.xz" }],
      modules: [{ platform: "LINUX", architecture: "X86_64", moduleName: "Android", moduleCategory: "PLATFORM", url: "https://example.com/android.tar.xz" }] },
    releaseNotesMarkdown: "### 6000.3.23f1 Release Notes\n\n#### Changes\n\n- Mono: Remove assertions from ToFileDescriptor ([UUM-145761](https://issuetracker.unity.com/api/v1.0/redirects/guid/UUM-145761)).",
    sourceSnapshotId: snapshotId, ingestionRunId: null as unknown as number, parserVersion: "test-report-v1"
  };
  async function importRelease(revision = "v1") {
    await withIngestionTransaction("test", "report-contract", async (client, runId) => {
      await upsertReleaseBundle(client, normalizeReleaseForStorage({ ...input, ingestionRunId: runId, parserVersion: revision }));
    });
  }
  const save = (next = report) => withReportWrite(client => saveIssueReport(client, { issueId: report.issueId, url, sourceUrl: issueIdResolver(report.issueId), report: next, snapshotId }));
  try {
    await importRelease();
    const baseKeys = Object.keys((await searchReleaseNotes({ q: "ToFileDescriptor", version: "6000.3.23f1" }))[0]);
    assert(!baseKeys.includes("enriched_search_vector"));
    assert(!baseKeys.includes("enriched_field_vectors"));
    assert.equal((await searchReleaseNotes({ q: "linux", version: "6000.3.23f1" })).length, 0);
    await save();
    assert.equal((await searchReleaseNotes({ q: "linux", version: "6000.3.23f1" })).length, 0, "flag off preserves results");
    process.env.ISSUE_REPORT_SEARCH_ENABLED = "true";
    for (const q of ["linux", "fd", "descriptors", "files", "linux file descriptors", "NamedPipeServerStream", "ToFileDescriptor", "UUM-145761", 'assertions "file descriptor"']) {
      const rows = await searchReleaseNotes({ q, version: "6000.3.23f1" });
      assert.equal(rows.length, 1, q);
      assert.equal(rows[0].issueReports[0].issueId, report.issueId);
      assert(rows[0].issueReports[0].excerpt.length <= 400);
      assert.equal(rows[0].total_count, "1");
    }
    const cases: Array<[string,string[],boolean]> = [
      ['"file descriptor"',["file","descriptor"],false],
      ['-"file descriptor"',["file","descriptor"],true],
      ['linux -"file descriptor"',["linux file","descriptor"],true],
      ['"file descriptor" OR linux',["linux file","descriptor"],true],
      ['linux "file descriptor"',["linux","file descriptor"],true],
      ['linux "file descriptor"',["linux file","descriptor"],false],
      ['"alpha the beta"',["alpha the beta"],true],
      ['-"alpha the beta"',["alpha","the beta"],true],
      ['"foo-bar baz"',["foo-bar baz"],true],
      ['"foo-bar baz"',["foo-bar","baz"],false],
      ['linux -"file descriptor" OR "named pipe"',["linux file descriptor","named","pipe"],false],
      ['"padding file"',["padding ".repeat(300)+"file"],true],
      ['"file descriptor"',["padding ".repeat(17000)+"file descriptor"],true],
      ['"file the descriptor"',["padding ".repeat(255)+"file the descriptor"],true],
      ['"file descriptor"',["padding ".repeat(255)+"file the descriptor"],false],
      ['"foo-bar baz"',["padding ".repeat(255)+"foo-bar baz"],true]
    ];
    for (const [q, fields, expected] of cases) {
      const canonical = (await query("SELECT websearch_to_tsquery('english',$1)::text AS q", [q])).rows[0].q;
      const ast = parseCanonicalQuery(canonical)!; validatePhraseSpans(ast);
      const values: unknown[] = [fields];
      const bind = (value: string) => { values.push(value); return `$${values.length}`; };
      const exact = compileFieldMatch(ast, bind, "combined", "fields");
      const candidate = candidateQuery(ast);
      const broad = candidate ? `combined @@ ${bind(serializeQuery(candidate))}::tsquery` : "TRUE";
      const result = await query(`WITH fields AS (
        SELECT coalesce(array_agg(vector), ARRAY[]::tsvector[]) AS fields FROM unnest($1::text[]) AS t(body)
        CROSS JOIN LATERAL unnest(issue_report_field_windows(body,'B')) AS f(vector)
      ), vectors AS (SELECT fields, combine_issue_report_vectors(fields) AS combined FROM fields)
      SELECT (${exact}) AS matched, (${broad}) AS candidate FROM vectors`, values);
      assert.equal(result.rows[0].matched, expected, q+JSON.stringify(fields).slice(0,100));
      assert(!result.rows[0].matched || result.rows[0].candidate);
    }
    await assert.rejects(searchReleaseNotes({ q: '"' + "word ".repeat(130) + '"' }), /128 word/);
    // Real row source boundaries, including negative phrases and combined terms.
    await save({ ...report, title: "linux file", description: "descriptor named pipe" });
    assert.equal((await searchReleaseNotes({ q: '"file descriptor"', version: input.metadata.version })).length, 0);
    assert.equal((await searchReleaseNotes({ q: 'linux -"file descriptor"', version: input.metadata.version })).length, 1);
    await save();
    await query("UPDATE release_note_items SET enriched_search_vector=NULL,enriched_field_vectors=NULL,enriched_search_version=NULL WHERE version=$1", [input.metadata.version]);
    assert.equal((await searchReleaseNotes({ q: "ToFileDescriptor", version: input.metadata.version })).length, 1, "unfinished vector fallback");
    assert.equal(await repairReportVectors(), 1);
    await buildReportSearchIndex(); await buildReportSearchIndex();
    await query("DROP INDEX idx_release_note_items_enriched_search");
    await assert.rejects(query("CREATE INDEX CONCURRENTLY idx_release_note_items_enriched_search ON release_note_items USING GIN(enriched_search_vector) WHERE 1/(id-id)>0"), /division by zero/);
    await buildReportSearchIndex();
    assert.equal((await query("SELECT indisvalid FROM pg_index WHERE indexrelid=to_regclass('idx_release_note_items_enriched_search')")).rows[0].indisvalid,true);
    await query("ANALYZE release_note_items");
    const before = (await query("SELECT body, normalized_sha256, impact_kind, risk_level FROM release_note_items WHERE version=$1", [input.metadata.version])).rows[0];
    // A report refresh holding the write lock blocks a concurrent release import.
    const writer = await getPool().connect();
    await writer.query("BEGIN");
    await writer.query("SELECT pg_advisory_xact_lock(187341,1)");
    let finished = false;
    const importing = importRelease("v2").then(() => { finished = true; });
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(finished, false);
    await saveIssueReport(writer, { issueId: report.issueId, url, sourceUrl: url, report: { ...report, description: report.description + " concurrencyproof" }, snapshotId });
    await writer.query("COMMIT"); writer.release();
    await importing;
    assert.equal((await searchReleaseNotes({ q: "concurrencyproof", version: input.metadata.version })).length, 1);
    const after = (await query("SELECT body, normalized_sha256, impact_kind, risk_level FROM release_note_items WHERE version=$1", [input.metadata.version])).rows[0];
    assert.deepEqual(after, before);
    // Re-import idempotence and per-page metadata do not duplicate notes.
    await importRelease("v2");
    const range = await searchReleaseNotesInRange([input.metadata.version], { q: "linux" }, 1, 0, { includeTotalCount: true });
    assert.equal(range.length, 1); assert.equal(range[0].total_count, "1");
    await withReportWrite(client => saveIssueReport(client, { issueId: report.issueId, url, sourceUrl: url, report: null, snapshotId }));
    assert.equal((await searchReleaseNotes({ q: "linux", version: input.metadata.version })).length, 0);
    assert.equal((await searchReleaseNotes({ q: "ToFileDescriptor", version: input.metadata.version }))[0].issueReports.length, 0);
    // Collector saves successful work, retains it after failures, and persists cooldown.
    await query("UPDATE issue_reports SET next_attempt_at=now() WHERE issue_id=$1", [report.issueId]);
    const fetched = { url, text: readFileSync("tests/fixtures/issue-reports/customer.html", "utf8"), status: 200, unavailable: false, report };
    await collectIssueReports({ issueId: report.issueId }, { fetchReport: async () => fetched });
    await query("UPDATE issue_reports SET next_attempt_at=now() WHERE issue_id=$1", [report.issueId]);
    const { TrackerFetchError } = await import("../../src/lib/issue-reports/fetch");
    await assert.rejects(collectIssueReports({ issueId: report.issueId }, { fetchReport: async () => { throw new TrackerFetchError("rate limited", new Date(Date.now()+3600000)); } }), /failed/);
    assert.equal((await searchReleaseNotes({ q: "linux", version: input.metadata.version })).length, 1);
    assert.equal((await collectIssueReports({ issueId: report.issueId })).skipped, "tracker cooldown");
    await query("UPDATE issue_report_collector_state SET cooldown_until=NULL WHERE singleton");
    // Lowercase IDs normalize consistently; a version scope excludes unrelated backlog.
    await query("UPDATE issue_reports SET next_attempt_at=now() WHERE issue_id=$1", [report.issueId]);
    await query("INSERT INTO issue_reports(issue_id,source_url,next_attempt_at) VALUES ('UUM-10001','https://issuetracker.unity.com/api/v1.0/redirects/guid/UUM-10001',now()-interval '1 day')");
    const called: string[] = [];
    await collectIssueReports({ issueId: "uum-145761", limit: 1 }, { fetchReport: async id => { called.push(id); return fetched; } });
    assert.deepEqual(called, [report.issueId]);
    await query("UPDATE issue_reports SET next_attempt_at=now() WHERE issue_id=$1", [report.issueId]);
    called.length=0;
    await collectIssueReports({ version: input.metadata.version, limit: 1 }, { fetchReport: async id => { called.push(id); return fetched; } });
    assert.deepEqual(called, [report.issueId]);
    // Mid-request budget expiry persists a backoff instead of stranding this row.
    await query("UPDATE issue_reports SET next_attempt_at=now() WHERE issue_id=$1", [report.issueId]);
    await assert.rejects(collectIssueReports({ issueId: report.issueId }, { budgetMs: 20, fetchReport: async () => {
      await new Promise(resolve => setTimeout(resolve, 30)); throw new Error("timed out");
    } }), /failed/);
    assert.equal((await query("SELECT next_attempt_at>now() AS delayed FROM issue_reports WHERE issue_id=$1",[report.issueId])).rows[0].delayed,true);
    // Overlapping collector invocations do not run duplicate work.
    const collectorLock=await getPool().connect();
    await collectorLock.query("SELECT pg_advisory_lock(187341,2)");
    assert.equal((await collectIssueReports({ issueId: report.issueId })).skipped, "already running");
    await collectorLock.query("SELECT pg_advisory_unlock(187341,2)"); collectorLock.release();
    // Pending work gets a turn even with multiple overdue retries. Health and
    // normal cron continue refreshing attempted reports from retired lines.
    await query("INSERT INTO issue_reports(issue_id,source_url,next_attempt_at) VALUES ('UUM-90010','https://issuetracker.unity.com/issues/90010',now())");
    await query(`INSERT INTO issue_mentions(issue_id,issue_url,unity_release_id,release_note_item_id,section,area,platforms,mention_kind)
      SELECT 'UUM-90010','https://issuetracker.unity.com/issues/90010',unity_release_id,id,section,area,platforms,impact_kind
      FROM release_note_items WHERE version=$1`,[input.metadata.version]);
    await query("UPDATE issue_reports SET last_attempt_at=now()-interval '3 days',next_attempt_at=now()-interval '3 days' WHERE issue_id IN ('UUM-10001','UUM-145761')");
    called.length=0;
    await collectIssueReports({ all:true,limit:2 }, { fetchReport:async id=>{called.push(id);return {...fetched,report:{...report,issueId:id}};} });
    assert.deepEqual(called,['UUM-145761','UUM-90010']);
    const {issueReportCoverage}=await import("../../src/lib/issue-reports/repository");
    const coverage=await issueReportCoverage({minorLines:['9999.0']});
    assert.equal(coverage.total,3,"previously attempted reports remain in active health after scope changes");
    called.length=0;
    await collectIssueReports({minorLines:['9999.0'],limit:1},{fetchReport:async id=>{called.push(id);return {...fetched,report:{...report,issueId:id}};}});
    assert.deepEqual(called,['UUM-10001']);
    // Multiple reports and tied rows still give one result per note and stable pages.
    await withReportWrite(async client=>{
      await saveIssueReport(client,{issueId:'UUM-90020',url,sourceUrl:url,report:{...report,issueId:'UUM-90020',title:'Extra Linux report'},snapshotId});
      await client.query("UPDATE release_note_items SET issue_ids=ARRAY['UUM-145761','UUM-90020'] WHERE version=$1",[input.metadata.version]);
      await client.query(`INSERT INTO release_note_items(unity_release_id,version,major_line,minor_line,stream,release_date,section,area,impact_kind,risk_level,body,issue_ids,source_url,source_order,parser_version,normalized_sha256)
        SELECT unity_release_id,version,major_line,minor_line,stream,release_date,section,area,impact_kind,risk_level,body,issue_ids,source_url,source_order,parser_version,'pagination-extra'
        FROM release_note_items WHERE version=$1`,[input.metadata.version]);
    });
    const first=await searchReleaseNotes({q:'linux',version:input.metadata.version,limit:1});
    const second=await searchReleaseNotes({q:'linux',version:input.metadata.version,limit:1,offset:1});
    assert.equal(first[0].total_count,'2'); assert.equal(second[0].total_count,'2');
    assert.notEqual(first[0].id,second[0].id);assert.equal(first[0].issueReports.length,2);
    assert.equal((await searchReleaseNotes({q:'linux',version:input.metadata.version,order:'rank'})).length,2);
    const timings: number[] = [];
    for (let n=0;n<15;n++) { const at=performance.now(); await searchReleaseNotes({ q: "linux file descriptors", version: input.metadata.version }); timings.push(performance.now()-at); }
    timings.sort((a,b)=>a-b);
    console.log(JSON.stringify({ fixtureQueryMs: { p50: timings[7], p95: timings[14] }, phraseCases: cases.length }));
    console.log("PASS issue-report DB contract: customer queries, phrases, fallback, re-import concurrency, withdrawal, collector retry/cooldown, index rerun");
  } finally { await getPool().end(); }
}
main().catch(error => { console.error(error); process.exitCode=1; });
