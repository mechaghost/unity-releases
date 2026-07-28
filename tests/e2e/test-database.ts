const DEFAULT_DATABASE_URL = "postgres://unity:unity@127.0.0.1:54329/unity_alerts";

export const E2E_SCHEMA = "unity_alerts_e2e";

export function baseDatabaseUrl() {
  return process.env.E2E_DATABASE_URL ?? DEFAULT_DATABASE_URL;
}

export function scopedDatabaseUrl() {
  const url = new URL(baseDatabaseUrl());
  url.searchParams.set("options", `-csearch_path=${E2E_SCHEMA},public`);
  return url.toString();
}
