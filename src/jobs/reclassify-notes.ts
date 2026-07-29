/**
 * One-shot reclassifier. Runs the current `classifyImpact` /
 * `classifyRisk` over every row in `release_note_items` and updates
 * every classification-derived column when it has changed.
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
import { reclassifyStoredReleaseNote } from "../lib/ingest/reclassification";
import { pathToFileURL } from "node:url";

export async function runReleaseNoteReclassification() {
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
      version: string;
      area: string | null;
      platforms: string[];
      impact_kind: string;
      risk_level: string;
      risk_reasons: string[];
      issue_ids: string[];
      issue_links_json: Array<{ id: string; url: string }>;
      package_names: string[];
      source_url: string;
      source_order: number;
      normalized_sha256: string;
    }>(
      `
        SELECT
          id, version, section, area, platforms, impact_kind, risk_level,
          risk_reasons, body, issue_ids, issue_links_json, package_names,
          source_url, source_order, normalized_sha256
        FROM release_note_items
        ORDER BY id
      `
    );

    let scanned = 0;
    let updated = 0;
    let mentionKindsUpdated = 0;
    const impactChanges = new Map<string, number>();
    const riskChanges = new Map<string, number>();

    for (const row of result.rows) {
      scanned += 1;
      const next = reclassifyStoredReleaseNote({
        version: row.version,
        section: row.section,
        area: row.area,
        platforms: row.platforms,
        impactKind: row.impact_kind,
        riskLevel: row.risk_level,
        riskReasons: row.risk_reasons,
        body: row.body,
        issueIds: row.issue_ids,
        issueLinks: row.issue_links_json,
        packageNames: row.package_names,
        sourceUrl: row.source_url,
        sourceOrder: row.source_order,
        normalizedSha256: row.normalized_sha256
      });
      if (!next.changed) continue;

      await client.query(
        `
          UPDATE release_note_items
          SET impact_kind = $1,
              risk_level = $2,
              risk_reasons = $3,
              normalized_sha256 = $4,
              updated_at = now()
          WHERE id = $5
        `,
        [
          next.impactKind,
          next.riskLevel,
          next.riskReasons,
          next.normalizedSha256,
          row.id
        ]
      );
      updated += 1;
      if (next.impactKind !== row.impact_kind) {
        const key = `${row.impact_kind} -> ${next.impactKind}`;
        impactChanges.set(key, (impactChanges.get(key) ?? 0) + 1);
      }
      if (next.riskLevel !== row.risk_level) {
        const key = `${row.risk_level} -> ${next.riskLevel}`;
        riskChanges.set(key, (riskChanges.get(key) ?? 0) + 1);
      }
      if (updated % 500 === 0) {
        console.error(`  ${updated.toLocaleString()} updated so far…`);
      }
    }

    const mentionRepair = await client.query(`
      UPDATE issue_mentions mention
      SET mention_kind = item.impact_kind
      FROM release_note_items item
      WHERE item.id = mention.release_note_item_id
        AND mention.mention_kind IS DISTINCT FROM item.impact_kind
    `);
    mentionKindsUpdated = mentionRepair.rowCount ?? 0;

    await client.query("COMMIT");
    const summary = {
      scanned,
      updated,
      mentionKindsUpdated,
      impactChanges: Object.fromEntries(impactChanges),
      riskChanges: Object.fromEntries(riskChanges)
    };
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runReleaseNoteReclassification().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
