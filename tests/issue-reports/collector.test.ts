import { afterEach, expect, test, vi } from "vitest";
const client = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn() }));
vi.mock("../../src/lib/db/client", () => ({ getPool: () => ({ connect: async () => client }), query: vi.fn() }));
import { collectIssueReports, parseCollectionArgs } from "../../src/jobs/poll-issue-reports";
afterEach(() => vi.clearAllMocks());
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
