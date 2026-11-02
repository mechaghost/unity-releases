import { pathToFileURL } from "node:url";
import { getPool } from "../lib/db/client";
import { withReportWrite } from "../lib/issue-reports/repository";

export async function repairReportVectors(batchSize = 100) {
  let total = 0;
  for (;;) {
    const count = await withReportWrite(async client => {
      const result = await client.query(`UPDATE release_note_items SET body=body
        WHERE id IN (SELECT id FROM release_note_items
          WHERE enriched_search_vector IS NULL OR enriched_search_version IS DISTINCT FROM 1
          ORDER BY id LIMIT $1)`, [Math.max(1, Math.min(batchSize, 500))]);
      return result.rowCount ?? 0;
    });
    total += count;
    if (!count) return total;
  }
}

export async function buildReportSearchIndex() {
  const client = await getPool().connect();
  try {
    await client.query("SELECT pg_advisory_lock(187341, 3)");
    await client.query("SET statement_timeout = '15min'");
    await client.query("SET lock_timeout = '5s'");
    const existing = await client.query<{ valid: boolean }>(`SELECT i.indisvalid AS valid
      FROM pg_index i WHERE i.indexrelid=to_regclass('idx_release_note_items_enriched_search')`);
    if (existing.rows[0] && !existing.rows[0].valid) {
      await client.query("DROP INDEX CONCURRENTLY IF EXISTS idx_release_note_items_enriched_search");
    }
    await client.query("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_release_note_items_enriched_search ON release_note_items USING GIN (enriched_search_vector)");
    const check = await client.query<{ valid: boolean }>(`SELECT i.indisvalid AS valid FROM pg_index i
      WHERE i.indexrelid=to_regclass('idx_release_note_items_enriched_search')`);
    if (!check.rows[0]?.valid) throw new Error("Issue report search index is invalid");
  } finally {
    await client.query("RESET statement_timeout; RESET lock_timeout").catch(() => undefined);
    await client.query("SELECT pg_advisory_unlock(187341, 3)").finally(() => client.release());
  }
}

async function main() {
  try {
    console.log(JSON.stringify({ rebuilt: await repairReportVectors() }));
    await buildReportSearchIndex();
  } finally { await getPool().end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main().catch(error => { console.error(error); process.exitCode=1; });
