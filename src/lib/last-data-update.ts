import { query } from "./db/client";

/** Use the actual completed refresh, never the page render time. */
export async function lastDataUpdate(): Promise<string | null> {
  try {
    const { rows } = await query<{ updated_at: Date | string | null }>(
      "SELECT MAX(finished_at) AS updated_at FROM ingestion_runs WHERE status = 'success'"
    );
    const value = rows[0]?.updated_at;
    return value ? new Date(value).toISOString() : null;
  } catch (error) {
    console.error("Could not load the last data update", error);
    return null;
  }
}
