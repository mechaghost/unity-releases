import { Pool, type QueryResultRow } from "pg";

let pool: Pool | null = null;

/**
 * SSL handling: Railway's public proxy URL (used for migrations + local
 * jobs against prod) presents a self-signed cert that Node's default
 * trust store rejects. Inside Railway, the internal URL doesn't use
 * TLS at all, so `ssl: undefined` is correct there.
 *
 * Set `PGSSL_NO_VERIFY=1` (or anything truthy) when running locally
 * against the public proxy to relax the verify check for that one
 * connection only - without leaning on the global
 * `NODE_TLS_REJECT_UNAUTHORIZED` escape hatch.
 */
function poolSslConfig() {
  if (process.env.PGSSL_NO_VERIFY) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 15,
    statement_timeout: 8000,
    ssl: poolSslConfig()
  });

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = []
) {
  return getPool().query<T>(text, values);
}
