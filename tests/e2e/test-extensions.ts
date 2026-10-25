import type { Client, PoolClient } from "pg";

/** Disposable test databases only. Keep shared extensions outside fixture schemas. */
export async function testSearchPath(client: Client | PoolClient, schema: string): Promise<string> {
  await client.query("CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public");
  // Existing local test databases can have the extension in the browser schema.
  // Discover it without moving it or changing production's schema/security.
  const { rows } = await client.query<{ schema: string }>(
    "SELECT n.nspname AS schema FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pg_trgm'"
  );
  return [...new Set([schema, rows[0].schema, "public"])]
    .map(name => `"${name.replaceAll('"', '""')}"`).join(",");
}
