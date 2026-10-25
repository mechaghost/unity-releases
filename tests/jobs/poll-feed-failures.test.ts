import { beforeEach, expect, test, vi } from "vitest";
const mocks=vi.hoisted(()=>({fetchText:vi.fn(),upsertBlogPosts:vi.fn(),recordSourceSnapshot:vi.fn(),withIngestionTransaction:vi.fn()}));
vi.mock("../../src/lib/ingest/fetch",()=>({fetchText:mocks.fetchText}));
vi.mock("../../src/lib/db/repositories",()=>({...mocks,upsertPackageBundle:vi.fn()}));
import { main as pollPackages } from "../../src/jobs/poll-packages";
import { main as pollNews } from "../../src/jobs/poll-news";
beforeEach(()=>{vi.clearAllMocks();mocks.withIngestionTransaction.mockImplementation(async(_a,_b,work)=>work({},1));});
test("registry outage fails a batch even when all fetches fail before DB writes",async()=>{
  vi.stubEnv("PACKAGE_ALLOWLIST","com.unity.entities,com.unity.collections");
  mocks.fetchText.mockResolvedValue({status:503,text:"Unavailable"});
  try { await expect(pollPackages()).rejects.toThrow("2 packages"); }
  finally {vi.unstubAllEnvs();}
  expect(mocks.withIngestionTransaction).not.toHaveBeenCalled();
});
test.each([503,200])("news rejects HTTP %s HTML without publishing empty success",async(status)=>{
  mocks.fetchText.mockResolvedValue({status,text:"<html><body>Unavailable</body></html>",finalUrl:"https://unity.com/blog/rss"});
  await expect(pollNews()).rejects.toThrow();
  expect(mocks.upsertBlogPosts).not.toHaveBeenCalled();
});

test("one successful package cannot hide a later fetch failure",async()=>{
  vi.stubEnv("PACKAGE_ALLOWLIST","com.unity.entities,com.unity.collections");
  mocks.fetchText.mockReset().mockResolvedValueOnce({status:200,text:JSON.stringify({name:"com.unity.entities",versions:{"1.0.0":{}}})}).mockResolvedValueOnce({status:503,text:"Unavailable"});
  mocks.withIngestionTransaction.mockResolvedValueOnce(undefined);
  try { await expect(pollPackages()).rejects.toThrow("1 packages"); }
  finally { vi.unstubAllEnvs(); }
  expect(mocks.withIngestionTransaction).toHaveBeenCalledTimes(1);
});

test("empty package target configuration cannot report a successful batch",async()=>{
  vi.stubEnv("PACKAGE_ALLOWLIST"," ,  , ");
  try { await expect(pollPackages()).rejects.toThrow("no configured targets"); }
  finally { vi.unstubAllEnvs(); }
  expect(mocks.fetchText).not.toHaveBeenCalled();
});

test.each([{}, {error:"unavailable"}, {name:"com.unity.wrong",versions:{"1.0.0":{}}}, {name:"com.unity.entities",versions:{}}])(
  "invalid registry payload cannot publish a successful package: %j",async(payload)=>{
    vi.stubEnv("PACKAGE_ALLOWLIST","com.unity.entities");
    mocks.fetchText.mockResolvedValue({status:200,text:JSON.stringify(payload)});
    try { await expect(pollPackages()).rejects.toThrow("1 packages"); }
    finally {vi.unstubAllEnvs();}
    expect(mocks.withIngestionTransaction).not.toHaveBeenCalled();
  }
);
