/**
 * One-shot maintenance job that re-runs `classifyImpact` over every
 * release_note_items row in place, then refreshes the search vector.
 * Use after tightening the classifier rules in src/lib/classification.ts.
 *
 *   DATABASE_URL='...' npx tsx src/jobs/reclassify.ts
 */

import { getPool } from "../lib/db/client";
import { classifyImpact } from "../lib/classification";

type Row = {
  id: number;
  section: string;
  body: string;
  impact_kind: string;
};

async function main() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const before = await client.query<{ impact_kind: string; count: string }>(
      `SELECT impact_kind, COUNT(*)::text AS count FROM release_note_items GROUP BY impact_kind ORDER BY 2::int DESC`
    );
    console.log("Before:");
    console.table(before.rows);

    const cursor = await client.query<Row>(
      `SELECT id, section, body, impact_kind FROM release_note_items`
    );
    let changed = 0;
    let unchanged = 0;
    let processed = 0;
    const batches: Array<Promise<unknown>> = [];

    await client.query("BEGIN");
    for (const row of cursor.rows) {
      processed += 1;
      const next = classifyImpact(row.section ?? "", row.body ?? "");
      if (next === row.impact_kind) {
        unchanged += 1;
        continue;
      }
      changed += 1;
      batches.push(
        client.query(
          `UPDATE release_note_items SET impact_kind = $1, updated_at = now() WHERE id = $2`,
          [next, row.id]
        )
      );
      // Flush in chunks to avoid building a huge promise queue.
      if (batches.length >= 500) {
        await Promise.all(batches);
        batches.length = 0;
        process.stdout.write(`. ${changed} updated / ${processed} processed\n`);
      }
    }
    if (batches.length) await Promise.all(batches);
    await client.query("COMMIT");

    const after = await client.query<{ impact_kind: string; count: string }>(
      `SELECT impact_kind, COUNT(*)::text AS count FROM release_note_items GROUP BY impact_kind ORDER BY 2::int DESC`
    );
    console.log("After:");
    console.table(after.rows);
    console.log(`Changed ${changed.toLocaleString()}, kept ${unchanged.toLocaleString()}.`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
