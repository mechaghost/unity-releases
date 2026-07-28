import { readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
import { baseDatabaseUrl, E2E_SCHEMA } from "./test-database";

const { Client } = pg;

async function main() {
  const client = new Client({ connectionString: baseDatabaseUrl() });
  await client.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${E2E_SCHEMA} CASCADE`);
    await client.query(`CREATE SCHEMA ${E2E_SCHEMA}`);
    await client.query(`SET search_path TO ${E2E_SCHEMA}, public`);

    const schema = await readFile(join(process.cwd(), "src/lib/db/schema.sql"), "utf8");
    const fixture = await readFile(join(process.cwd(), "tests/e2e/core-regression.sql"), "utf8");
    await client.query(schema);
    await client.query(fixture);
    console.log(`E2E database fixture ready in schema ${E2E_SCHEMA}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
