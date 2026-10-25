import { beforeEach, expect, test, vi } from "vitest";
const mocks=vi.hoisted(()=>({fetchText:vi.fn(),query:vi.fn()}));
vi.mock("../../src/lib/ingest/fetch",()=>({fetchText:mocks.fetchText}));
vi.mock("../../src/lib/db/client",()=>({query:mocks.query}));
vi.mock("../../src/lib/ingest/unity-packages",()=>({UNITY_OFFICIAL_PACKAGES:["com.unity.entities"]}));
import { main } from "../../src/jobs/poll-package-docs";
beforeEach(()=>{vi.resetAllMocks();mocks.query.mockResolvedValue({rows:[{major:"6000",minor:"7"}]});});
test.each([200,401,403,429,503])("documentation HTTP %s preserves rows and fails whole job",async(status)=>{
 mocks.fetchText.mockResolvedValue({status,text:"Unavailable"});
 await expect(main()).rejects.toThrow("incomplete for 1 packages");
 expect(mocks.query.mock.calls.some(([sql])=>sql.includes("DELETE"))).toBe(false);
});
test("database target lookup failure cannot fall back and delete newer package data",async()=>{
 mocks.query.mockRejectedValue(new Error("timeout"));
 await expect(main()).rejects.toThrow("Cannot select package documentation target versions");
 expect(mocks.fetchText).not.toHaveBeenCalled();
});

test("failure probing a newer minor cannot downgrade to an older aligned version",async()=>{
  mocks.query.mockResolvedValue({rows:[{major:"6000",minor:"7"},{major:"6000",minor:"6"}]});
  mocks.fetchText.mockResolvedValueOnce({status:503,text:"Unavailable"})
    .mockResolvedValueOnce({status:200,text:'<h2>[6.6.0] - 2026-09-01</h2><p>Changes</p>'});
  await expect(main()).rejects.toThrow("incomplete for 1 packages");
  expect(mocks.query.mock.calls.some(([sql])=>/INSERT|DELETE/.test(sql))).toBe(false);
});
