import { query } from "../lib/db/client";
import { INVARIANTS, type Invariant } from "../lib/invariants";

/**
 * Assert the post-ingest data invariants and fail the run when stored
 * data is corrupt.
 *
 * Runs last in the mega-cron so it sees the state every other job just
 * produced. An "error" breach exits non-zero, which Railway surfaces as
 * a failed deployment - the signal that was missing every time a parser
 * quietly wrote plausible-looking garbage.
 *
 * Run locally with:
 *   DATABASE_URL=… npm run check:invariants
 */

export type InvariantResult = {
  name: string;
  severity: Invariant["severity"];
  ok: boolean;
  count: number;
  threshold: number;
  sample: string | null;
  describe: string;
  error?: string;
};

export async function runInvariant(inv: Invariant): Promise<InvariantResult> {
  const threshold = inv.threshold ?? 0;
  try {
    const res = await query<{ n: number | string; sample: string | null }>(inv.sql);
    const row = res.rows[0];
    const count = Number(row?.n ?? 0);
    return {
      name: inv.name,
      severity: inv.severity,
      ok: count <= threshold,
      count,
      threshold,
      sample: row?.sample ?? null,
      describe: inv.describe
    };
  } catch (err) {
    // A check that can't run is itself a failure signal (missing table,
    // renamed column) - but never a silent one.
    return {
      name: inv.name,
      severity: inv.severity,
      ok: false,
      count: -1,
      threshold,
      sample: null,
      describe: inv.describe,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

export async function runAllInvariants(
  invariants: Invariant[] = INVARIANTS
): Promise<InvariantResult[]> {
  const results: InvariantResult[] = [];
  for (const inv of invariants) {
    results.push(await runInvariant(inv));
  }
  return results;
}

export function summarize(results: InvariantResult[]) {
  const failed = results.filter((r) => !r.ok);
  return {
    total: results.length,
    passed: results.length - failed.length,
    errors: failed.filter((r) => r.severity === "error").length,
    warnings: failed.filter((r) => r.severity === "warn").length
  };
}

async function main() {
  const results = await runAllInvariants();
  const summary = summarize(results);

  for (const r of results) {
    if (r.ok) continue;
    console.error(
      JSON.stringify({
        event: "invariant_breach",
        severity: r.severity,
        name: r.name,
        count: r.count,
        threshold: r.threshold,
        sample: r.sample,
        why: r.describe,
        ...(r.error ? { error: r.error } : {})
      })
    );
  }

  console.log(JSON.stringify({ event: "invariants_summary", ...summary }));

  if (summary.errors > 0) {
    console.error(
      `${summary.errors} data invariant(s) breached - see invariant_breach lines above.`
    );
    process.exitCode = 1;
  }
}

const isDirectRun = process.argv[1]?.endsWith("check-invariants.ts");
if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
