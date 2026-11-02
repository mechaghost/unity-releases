import { afterEach, expect, test, vi } from "vitest";
const client = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn() }));
const dbQuery=vi.hoisted(()=>vi.fn());
vi.mock("../../src/lib/db/client", () => ({ getPool: () => ({ connect: async () => client }), query: dbQuery }));
import { collectIssueReports, parseCollectionArgs } from "../../src/jobs/poll-issue-reports";
afterEach(() => vi.resetAllMocks());
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
