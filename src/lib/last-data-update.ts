import { unstable_cache } from "next/cache";
import { query } from "./db/client";

/** Use the actual completed refresh, never the page render time. */
export async function lastDataUpdate(): Promise<string | null> {
  try {
    return await cachedLastDataUpdate();
  } catch (error) {
    console.error("Could not load the last data update", error);
    return null;
  }
}

// Public ingestion metadata is shared across visitors, never cookie-dependent.
const cachedLastDataUpdate = unstable_cache(async () => {
  const { rows } = await query<{ updated_at: Date | string | null }>(
    "SELECT MAX(finished_at) AS updated_at FROM ingestion_runs WHERE status = 'success'"
  );
  const value = rows[0]?.updated_at;
  return value ? new Date(value).toISOString() : null;
}, ["last-data-update-v1"], { revalidate: 300 });
