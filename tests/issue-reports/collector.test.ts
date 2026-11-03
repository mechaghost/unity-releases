import { afterEach, expect, test, vi } from "vitest";
const client = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn() }));
const dbQuery=vi.hoisted(()=>vi.fn());
vi.mock("../../src/lib/db/client", () => ({ getPool: () => ({ connect: async () => client }), query: dbQuery }));
import { collectIssueReports, parseCollectionArgs } from "../../src/jobs/poll-issue-reports";
import { TrackerFetchError } from "../../src/lib/issue-reports/fetch";
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); });

test.each([
  [new TrackerFetchError("private response body", undefined, true, 404), "parser", 404, "exponential-backoff"],
  [new TrackerFetchError("private header", new Date("2030-01-01T00:00:00Z"), false, 429), "cooldown", 429, "shared-cooldown"],
  [new TypeError("private connection URL"), "network-or-type-error", undefined, "exponential-backoff"],
  [Object.assign(new Error("private database detail"), { name: "private error name" }), "unexpected", undefined, "exponential-backoff"]
] as const)("logs a safe per-item diagnostic and preserves retry handling: %s", async (error, errorClass, httpStatus, retry) => {
  client.query.mockResolvedValue({ rows: [{ locked: true }] });
  dbQuery.mockImplementation(async (sql: string) => {
    if (sql.startsWith("SELECT cooldown_until")) return { rows: [{ cooling: false }] };
    if (sql.includes("WITH eligible AS")) return { rows: [{ issue_id: "UUM-145761", source_url: "https://issuetracker.unity.com/issues/private", canonical_url: null }] };
    if (sql.includes("count(*)::int AS total")) return { rows: [{ total: 1, failed: 1 }] };
    return { rows: [] };
  });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const fetchReport = vi.fn().mockRejectedValue(error);
  await expect(collectIssueReports({ issueId: "UUM-145761" }, { fetchReport })).rejects.toThrow("failed for 1 report");
  expect(fetchReport).toHaveBeenCalledTimes(1);
  expect(log).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ event: "issue_report_failed", issueId: "UUM-145761", errorClass,
    ...(httpStatus ? { httpStatus } : {}), retry }));
  expect(log.mock.calls.flat().join(" ")).not.toContain("private");
  const failure = dbQuery.mock.calls.find(([sql]) => sql.startsWith("UPDATE issue_reports SET last_outcome"))!;
  expect(failure[0]).toContain("300 * power(2, least(failure_count, 9))");
  expect(failure[1]).toEqual(["UUM-145761", error.message, error instanceof TrackerFetchError ? error.retryAt ?? null : null]);
  expect(dbQuery.mock.calls.some(([sql]) => sql.includes("SET cooldown_until"))).toBe(retry === "shared-cooldown");
});
test("leaves pending reports untouched when the batch cannot fit another report deadline", async()=>{
  client.query.mockResolvedValue({rows:[{locked:true}]});
  dbQuery.mockResolvedValueOnce({rows:[{cooling:false}]})
    .mockResolvedValueOnce({rows:[]})
    .mockResolvedValueOnce({rows:[{issue_id:"UUM-145761",source_url:"https://issuetracker.unity.com/issues/example",canonical_url:null}]})
    .mockResolvedValueOnce({rows:[{total:1,pending:1}]})
    .mockResolvedValueOnce({rows:[]});
  const fetchReport=vi.fn();
  const result=await collectIssueReports({issueId:"UUM-145761"},{budgetMs:60_000,fetchReport});
  expect(result).toMatchObject({requested:0,failed:0,budgetReached:true});
  expect(fetchReport).not.toHaveBeenCalled();
  expect(dbQuery.mock.calls.some(([sql])=>sql.startsWith("UPDATE issue_reports SET last_outcome"))).toBe(false);
});
test("releases a checked-out connection if acquiring the worker lock fails", async () => {
  const error=new Error("connection lost");client.query.mockRejectedValueOnce(error);
  await expect(collectIssueReports({issueId:"UUM-145761"})).rejects.toThrow("connection lost");
  expect(client.release).toHaveBeenCalledWith(error);
});
test("CLI selectors are explicit and invalid or missing values fail before collection", () => {
  expect(parseCollectionArgs(["--issue","uum-145761"])).toEqual({issueId:"UUM-145761"});
  expect(parseCollectionArgs(["--version","6000.3.23f1"])).toEqual({version:"6000.3.23f1"});
  expect(parseCollectionArgs(["--inventory"])).toEqual({inventory:true});
  for(const args of [["--issue"],["--version","--all"],["--version","bad"],["--unknown"]]) {
    expect(()=>parseCollectionArgs(args)).toThrow();
  }
});
