import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../../src/lib/db/client", () => ({ query: mocks.query }));
import { CORE_JOBS, evaluateJobFreshness, runScheduledJob } from "../../src/lib/ingest/job-health";

beforeEach(() => { mocks.query.mockReset().mockResolvedValue({ rows: [{ id: "1" }] }); });

test("all expected jobs appear before their first run", () => {
  const rows = evaluateJobFreshness([]);
  expect(rows).toHaveLength(CORE_JOBS.length);
  expect(rows.every(row => row.status === "never" && row.isStale)).toBe(true);
});
test("legacy success cannot hide a failed modern batch", () => {
  const now = Date.parse("2026-10-24T00:00:00Z");
  const rows = evaluateJobFreshness([
    {job_name:"poll-editor",last_success:"2026-10-23T12:00:00Z",last_run:"2026-10-24T00:00:00Z",latest_status:"failed"},
    {job_name:"poll-legacy-lts",last_success:"2026-10-24T00:00:00Z",last_run:"2026-10-24T00:00:00Z",latest_status:"success"}
  ], now);
  expect(rows.find(row=>row.jobName==="poll-editor")?.status).toBe("failed");
  expect(rows.find(row=>row.jobName==="poll-legacy-lts")?.status).toBe("ok");
});
test("fresh successful batches expire after three missed 12h polls", () => {
  const rows=evaluateJobFreshness([{job_name:"poll-news",last_success:"2026-10-22T00:00:00Z",last_run:"2026-10-22T00:00:00Z",latest_status:"success"}], Date.parse("2026-10-24T00:00:00Z"));
  expect(rows.find(row=>row.jobName==="poll-news")?.status).toBe("stale");
});
test("whole batch failure survives successful individual work", async () => {
  let itemCommitted=false;
  await expect(runScheduledJob("poll-packages",async()=>{itemCommitted=true;throw new Error("second package failed");})).rejects.toThrow("second package failed");
  expect(itemCommitted).toBe(true);
  expect(mocks.query.mock.calls[0][0]).toContain("INSERT INTO core_job_runs");
  expect(mocks.query.mock.calls[1][0]).toContain("status='failed'");
  expect(mocks.query.mock.calls.some(([sql])=>sql.includes("status='success'"))).toBe(false);
});

test("starting a retry does not hide the previous failed batch", () => {
  const rows=evaluateJobFreshness([{job_name:"poll-news",last_success:"2026-10-23T12:00:00Z",last_run:"2026-10-24T00:00:00Z",latest_status:"running",last_completed_status:"failed"}],Date.parse("2026-10-24T00:00:00Z"));
  expect(rows.find(row=>row.jobName==="poll-news")?.status).toBe("failed");
});

test("an interrupted running batch cannot look healthy indefinitely", () => {
  const now = Date.parse("2026-10-24T04:00:00Z");
  const rows = evaluateJobFreshness([{job_name:"poll-news",last_success:"2026-10-24T00:00:00Z",last_run:"2026-10-24T01:00:00Z",latest_status:"running",last_completed_status:"success"}], now);
  expect(rows.find(row=>row.jobName==="poll-news")?.status).toBe("failed");
});
