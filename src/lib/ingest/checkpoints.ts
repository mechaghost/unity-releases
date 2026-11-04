import type { PoolClient } from "pg";
import { query } from "../db/client";

export type Checkpoint<T> = { value: T; checkedAt: string };
export async function readCheckpoint<T>(key: string): Promise<Checkpoint<T> | null> {
  const { rows } = await query<{ value_json: T; updated_at: Date }>(
    "SELECT value_json, updated_at FROM ingestion_checkpoints WHERE key=$1", [key]);
  return rows[0] ? { value: rows[0].value_json, checkedAt: new Date(rows[0].updated_at).toISOString() } : null;
}

export async function writeCheckpoint(client: PoolClient, key: string, value: unknown) {
  await client.query(`INSERT INTO ingestion_checkpoints(key,value_json) VALUES ($1,$2)
    ON CONFLICT (key) DO UPDATE SET value_json=EXCLUDED.value_json, updated_at=now()`, [key, JSON.stringify(value)]);
}

export type LegacyCheck = { lastmod: string | null; parserVersion: string; complete: boolean };
export function legacyCheckIsFresh(check: Checkpoint<LegacyCheck> | null, lastmod: string | null, parserVersion: string, now = Date.now()) {
  if (!check?.value.complete || check.value.parserVersion !== parserVersion) return false;
  const observed = Date.parse(check.value.lastmod ?? "");
  const current = Date.parse(lastmod ?? "");
  const checked = Date.parse(check.checkedAt);
  return Number.isFinite(current) && Number.isFinite(observed) && current === observed
    && Number.isFinite(checked) && checked <= now && now - checked < 7 * 86_400_000;
}
