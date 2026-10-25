import { listIngestionFreshness } from "../lib/db/repositories";
import { getPool } from "../lib/db/client";

async function main() {
  try {
    const ingestion = await listIngestionFreshness();
    const status = ingestion.some(row => row.isStale) ? "degraded" : "ok";
    console.log(JSON.stringify({ status, checkedAt: new Date().toISOString(), ingestion }));
    if (status !== "ok") process.exitCode = 1;
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (process.env.DATABASE_URL) await getPool().end();
  }
}
void main();
