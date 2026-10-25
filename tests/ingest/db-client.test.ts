import { EventEmitter } from "node:events";
import { afterEach, expect, test, vi } from "vitest";
const mock = vi.hoisted(() => ({ config: undefined as Record<string, unknown> | undefined }));
vi.mock("pg", () => ({ Pool: class extends EventEmitter {
  constructor(config: Record<string, unknown>) { super(); mock.config = config; }
} }));
import { getPool } from "../../src/lib/db/client";
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
test("a disconnected idle client is reported without an unhandled error", () => {
  vi.stubEnv("DATABASE_URL", "postgres://unused");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const pool = getPool();
  expect(() => pool.emit("error", new Error("connection lost"))).not.toThrow();
  expect(log).toHaveBeenCalledWith("Idle database connection failed", { message: "connection lost" });
  expect(mock.config?.connectionTimeoutMillis).toBe(10_000);
  expect(getPool()).toBe(pool);
});
