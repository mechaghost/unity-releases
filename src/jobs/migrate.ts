import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { query } from "../lib/db/client";

async function main() {
  const schema = await readFile(join(process.cwd(), "src/lib/db/schema.sql"), "utf8");
  await query(schema);
  console.log("Database schema applied");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
