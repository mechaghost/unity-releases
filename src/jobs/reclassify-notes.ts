/**
 * One-shot reclassifier. Runs the current `classifyImpact` /
 * `classifyRisk` over every row in `release_note_items` and updates
 * the stored `impact_kind` + `risk_level` columns when they've changed.
 *
 * Use this when the classifier logic in `src/lib/classification.ts`
 * changes and you want existing rows to pick up the new bucketing
 * without waiting for the next ingestion cycle to re-fetch each
 * version's markdown.
 *
 * Limitations:
 * - Operates on the already-parsed `section` + `body` columns. Parser
 *   changes (e.g. recognising new heading shapes that create new
 *   sections) require a full re-fetch, not just this script.
 * - SQL UPDATE is issued per-row but batched in a single transaction
 *   so a partial run can't half-apply.
 *
 * Run: `DATABASE_URL=... npx tsx src/jobs/reclassify-notes.ts`
 */
import { getPool } from "../lib/db/client";
import { classifyImpact, classifyRisk } from "../lib/classification";

async function main() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Pull everything we need to reclassify. Order-stable so progress
    // logs are predictable. ~167K rows in prod; comfortably in-memory.
    const result = await client.query<{
      id: number;
      section: string;
      body: string;
      impact_kind: string;
      risk_level: string;
    }>(
      "SELECT id, section, body, impact_kind, risk_level FROM release_note_items"
    );

    let scanned = 0;
    let updated = 0;
    const impactChanges = new Map<string, number>();
    const riskChanges = new Map<string, number>();

    for (const row of result.rows) {
      scanned += 1;
      const newImpact = classifyImpact(row.section, row.body);
      const newRisk = classifyRisk(row.section, newImpact, row.body);
      if (newImpact === row.impact_kind && newRisk === row.risk_level) continue;

      await client.query(
        "UPDATE release_note_items SET impact_kind = $1, risk_level = $2 WHERE id = $3",
        [newImpact, newRisk, row.id]
      );
      updated += 1;
      if (newImpact !== row.impact_kind) {
        const key = `${row.impact_kind} -> ${newImpact}`;
        impactChanges.set(key, (impactChanges.get(key) ?? 0) + 1);
      }
      if (newRisk !== row.risk_level) {
        const key = `${row.risk_level} -> ${newRisk}`;
        riskChanges.set(key, (riskChanges.get(key) ?? 0) + 1);
      }
      if (updated % 500 === 0) {
        console.error(`  ${updated.toLocaleString()} updated so far…`);
      }
    }

    await client.query("COMMIT");
    console.log(
      JSON.stringify(
        {
          scanned,
          updated,
          impactChanges: Object.fromEntries(impactChanges),
          riskChanges: Object.fromEntries(riskChanges)
        },
        null,
        2
      )
    );
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
