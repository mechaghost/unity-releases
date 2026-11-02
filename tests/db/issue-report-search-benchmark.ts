/** Read local public data; write only a disposable benchmark schema. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import pg from "pg";
import { baseDatabaseUrl } from "../e2e/test-database";
import { testSearchPath } from "../e2e/test-extensions";
import { buildReleaseNoteSearchQuery, buildReleaseNoteWhereForVersions } from "../../src/lib/search";
import { parseCanonicalQuery } from "../../src/lib/issue-reports/query";

async function main() {
  const connectionString = baseDatabaseUrl();
  assert(["127.0.0.1", "localhost"].includes(new URL(connectionString).hostname), "Benchmark is restricted to local databases");
  const client = new pg.Client({ connectionString }); await client.connect();
  const schema = "unity_issue_report_benchmark";
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE; CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${await testSearchPath(client, schema)}`);
    await client.query("SET statement_timeout='10min'");
    await client.query(readFileSync("src/lib/db/schema.sql", "utf8"));
    await client.query(`INSERT INTO unity_releases(id,version,major_line,minor_line,patch,suffix_channel,suffix_number,stream,release_date,release_page_url,parser_version,normalized_sha256)
      SELECT id,version,major_line,minor_line,patch,suffix_channel,suffix_number,stream,release_date,release_page_url,parser_version,normalized_sha256 FROM public.unity_releases`);
    const at = performance.now();
    await client.query(`INSERT INTO release_note_items(id,unity_release_id,version,major_line,minor_line,stream,release_date,section,area,platforms,impact_kind,risk_level,risk_reasons,body,issue_ids,issue_links_json,package_names,source_url,source_order,parser_version,normalized_sha256)
      SELECT id,unity_release_id,version,major_line,minor_line,stream,release_date,section,area,platforms,impact_kind,risk_level,risk_reasons,body,issue_ids,issue_links_json,package_names,source_url,source_order,parser_version,normalized_sha256
      FROM public.release_note_items WHERE id % 8 = 0 OR issue_ids @> ARRAY['UUM-145761']`);
    console.log(JSON.stringify({ copyAndIndexVectorsMs: performance.now()-at, notes: (await client.query("SELECT count(*) FROM release_note_items")).rows[0].count }));
    // Synthetic 3KB report descriptions stress enrichment for 500 real issue IDs.
    await client.query(`INSERT INTO issue_reports(issue_id,source_url,title,description,content_available,last_success_at)
      SELECT issue_id,'https://issuetracker.unity.com/','Synthetic benchmark Linux report',repeat('Linux file descriptors build scripts memory crash test. ',60),true,now()
      FROM (SELECT DISTINCT unnest(issue_ids) AS issue_id FROM release_note_items LIMIT 500) ids`);
    const enrichedAt=performance.now();
    await client.query("UPDATE release_note_items SET body=body WHERE issue_ids && ARRAY(SELECT issue_id FROM issue_reports)");
    console.log(JSON.stringify({ enrichMs: performance.now()-enrichedAt }));
    await client.query("CREATE INDEX idx_release_note_items_enriched_search ON release_note_items USING GIN(enriched_search_vector)");
    await client.query("ANALYZE release_note_items");
    const versions = (await client.query("SELECT version FROM unity_releases WHERE minor_line='6000.3' ORDER BY release_date DESC LIMIT 20")).rows.map(row => row.version);
    const results: unknown[]=[];
    for (const q of ['memory', 'linux file descriptors', 'ToFileDescriptor', '"file descriptor"', 'linux -"file descriptor"', '-"file descriptor"']) {
      const canonical=(await client.query("SELECT websearch_to_tsquery('english',$1)::text AS q",[q])).rows[0].q;
      for (const enabled of [false,true]) for (const range of [false,true]) {
        process.env.ISSUE_REPORT_SEARCH_ENABLED=String(enabled);
        const filters={q, ...(enabled && q.includes('"') ? {reportQuery:parseCanonicalQuery(canonical)} : {})};
        const sql=range ? buildReleaseNoteWhereForVersions(versions,filters,50,0,{includeTotalCount:true}) : buildReleaseNoteSearchQuery({...filters,limit:50});
        const timings:number[]=[];
        for(let n=0;n<11;n++) { const start=performance.now(); await client.query(sql.text,sql.values); if(n)timings.push(performance.now()-start); }
        timings.sort((a,b)=>a-b);
        assert(timings[9]<8000);
        results.push({q,enabled,range,p50:Math.round(timings[5]*100)/100,p95:Math.round(timings[9]*100)/100});
      }
    }
    console.log(JSON.stringify({results, storage:(await client.query("SELECT pg_size_pretty(pg_relation_size('idx_release_note_items_enriched_search')) AS enriched_index, pg_size_pretty(pg_total_relation_size('release_note_items')) AS total_notes")).rows[0]},null,2));
    const plan=buildReleaseNoteSearchQuery({q:'linux file descriptors',limit:50});
    console.log((await client.query('EXPLAIN (ANALYZE, BUFFERS) '+plan.text,plan.values)).rows.map(row=>row['QUERY PLAN']).join('\n'));
  } finally { await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(()=>undefined); await client.end(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
