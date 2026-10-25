import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { baseDatabaseUrl } from "../e2e/test-database";

// Dedicated throwaway schema: never use public or the browser fixture schema.
const pool = new pg.Pool({ connectionString: baseDatabaseUrl() });
const client = await pool.connect();
const schema = `ingestion_contract_${process.pid}`;
try {
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`SET search_path TO ${schema}, public`);
  const sql = await readFile("src/lib/db/schema.sql", "utf8");
  // Start at the old schema to prove ALTERs upgrade existing resources.
  const boundary = sql.indexOf("-- Whole-job outcomes survive");
  assert.ok(boundary > 0);
  await client.query(sql.slice(0,boundary));
  await client.query(sql);
  await client.query(sql);
  const url = new URL(baseDatabaseUrl());
  url.searchParams.set("options", `-csearch_path=${schema},public`);
  process.env.DATABASE_URL = url.toString();
  const { upsertResource, markResourceUnavailable, listResources, listIngestionFreshness, listResourceRechecks, recordResourceCheckAttempt } = await import("../../src/lib/db/repositories");
  const { parseResourcePage } = await import("../../src/lib/ingest/resources");
  const slug = "a-beginners-guide-to-unity-cli-and-the-pipeline-package";
  const resource = parseResourcePage(await readFile(`tests/fixtures/resources/${slug}.content.html`, "utf8"), `https://unity.com/resources/${slug}`, "2026-09-17");
  assert.ok(resource);
  const run = await client.query("INSERT INTO ingestion_runs(source_type,job_name,parser_version) VALUES ('resources','test','contract-v1') RETURNING id");
  await upsertResource(client,resource,"2026-09-17",run.rows[0].id,null);
  await markResourceUnavailable(client,resource.url);
  assert.equal((await listResources({includeMarketing:true,includeEnterprise:true})).total,0);
  assert.equal((await client.query("SELECT count(*)::int n FROM resources")).rows[0].n,1,"retirement preserves historical row");
  await upsertResource(client,resource,"2026-09-17",run.rows[0].id,null);
  assert.equal((await listResources({includeMarketing:true,includeEnterprise:true})).total,1,"valid recovery makes link visible");
  await client.query("INSERT INTO core_job_runs(job_name,status,finished_at) VALUES ('poll-editor','success',now()-interval '12 hours'),('poll-editor','failed',now()),('poll-legacy-lts','success',now())");
  const result = await client.query("SELECT job_name,(array_agg(status ORDER BY started_at DESC,id DESC))[1] status FROM core_job_runs GROUP BY job_name");
  assert.equal(result.rows.find(r=>r.job_name==='poll-editor')?.status,'failed');
  assert.equal(result.rows.find(r=>r.job_name==='poll-legacy-lts')?.status,'success');
  const health = await listIngestionFreshness();
  assert.equal(health.find(row=>row.jobName==='poll-editor')?.status,'failed');
  assert.equal(health.find(row=>row.jobName==='poll-legacy-lts')?.status,'ok');
  assert.equal(health.find(row=>row.jobName==='poll-package-docs')?.status,'never');
  const {runScheduledJob} = await import("../../src/lib/ingest/job-health");
  await assert.rejects(runScheduledJob("poll-packages",async()=>{throw new Error("registry failed");}), /registry failed/);
  assert.equal((await listIngestionFreshness()).find(row=>row.jobName==='poll-packages')?.status,'failed');
  await runScheduledJob("poll-packages",async()=>{});
  assert.equal((await listIngestionFreshness()).find(row=>row.jobName==='poll-packages')?.status,'ok');
  await client.query("INSERT INTO resources(slug,url,title) SELECT 'queue-'||n,'https://unity.com/resources/queue-'||n,'Queue' FROM generate_series(1,101) n");
  const firstQueue = await listResourceRechecks(100);
  assert.equal(firstQueue.length,100);
  assert.ok(!firstQueue.some(row=>row.url.endsWith('queue-101')));
  await recordResourceCheckAttempt(firstQueue[0].url);
  const nextQueue = await listResourceRechecks(100);
  assert.ok(nextQueue.some(row=>row.url.endsWith('queue-101')), 'failed attempts advance the bounded queue');
  assert.ok(!nextQueue.some(row=>row.url===firstQueue[0].url));
  assert.equal((await client.query("SELECT unavailable_at FROM resources WHERE url=$1",[firstQueue[0].url])).rows[0].unavailable_at,null,'failed checks do not retire good content');
  console.log("Ingestion migration and availability database contract passed");
} finally {
  await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  client.release(); await pool.end();
  if (process.env.DATABASE_URL) { const {getPool} = await import("../../src/lib/db/client"); await getPool().end(); }
}
