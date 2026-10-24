import nextEnv from "@next/env";
import { spawn } from "node:child_process";

nextEnv.loadEnvConfig(process.cwd());
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Set DATABASE_URL in .env.local before starting the preview.");
if (databaseUrl.includes("unity_alerts_e2e")) {
  throw new Error("The normal preview cannot use browser-test fixtures. Use the local public schema.");
}
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3100"], {
  stdio: "inherit", env: { ...process.env, NEXT_DIST_DIR: ".next" }
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
