import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchText: vi.fn(),
  query: vi.fn(), release: vi.fn(),
  createIngestionRun: vi.fn(), finishIngestionRun: vi.fn(),
  getDiscourseStaffPollTimes: vi.fn(), markDiscourseStaffUserPolled: vi.fn(),
  getDiscoursePostFreshness: vi.fn(), recordSourceSnapshot: vi.fn(),
  upsertDiscourseStaffUsers: vi.fn(), markMissingDiscourseStaffUsersInactive: vi.fn(),
  upsertDiscourseCategories: vi.fn(), findDiscourseStaffUserDbId: vi.fn(),
  upsertDiscoursePost: vi.fn(), insertDiscoursePostRevisionIfChanged: vi.fn(),
  tombstoneDiscoursePost: vi.fn()
}));

vi.mock("../../src/lib/ingest/fetch", () => ({
  fetchText: mocks.fetchText,
  DEFAULT_USER_AGENT: "test-ua"
}));

vi.mock("../../src/lib/db/client", () => ({
  getPool: () => ({ connect: async () => ({ query: mocks.query, release: mocks.release }) })
}));
vi.mock("../../src/lib/db/repositories", () => mocks);

import { pollDiscussions, RequestBudget } from "../../src/jobs/poll-discussions";

function fakeSource(status: number, text = "{}") {
  return {
    url: "https://example.test/x",
    finalUrl: "https://example.test/x",
    status,
    etag: null,
    lastModified: null,
    text,
    sha256: "deadbeef"
  };
}

beforeEach(() => {
  mocks.fetchText.mockReset();
  // The fetch path calls sleep() between successful requests. Stub
  // setTimeout-via-Promise out so the test suite doesn't actually
  // wait a real second per fetch.
  vi.stubGlobal("setTimeout", ((fn: () => void) => {
    fn();
    return 0 as unknown as NodeJS.Timeout;
  }) as typeof setTimeout);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("RequestBudget", () => {
  test("returns ok and increments spent on a successful fetch", async () => {
    mocks.fetchText.mockResolvedValueOnce(fakeSource(200, '{"ok":true}'));
    const budget = new RequestBudget(10);
    const result = await budget.fetch("https://example.test/site.json");
    expect(result.kind).toBe("ok");
    expect(budget.spent).toBe(1);
    expect(budget.exhausted).toBe(false);
    expect(budget.throttled).toBe(false);
  });

  test("sends a browser user-agent so Cloudflare doesn't 403 the Discourse API", async () => {
    mocks.fetchText.mockResolvedValueOnce(fakeSource(200));
    const budget = new RequestBudget(10);
    await budget.fetch("https://discussions.unity.com/site.json");
    expect(mocks.fetchText).toHaveBeenCalledWith(
      "https://discussions.unity.com/site.json",
      expect.objectContaining({ userAgent: expect.stringContaining("Mozilla/5.0") })
    );
  });

  test("treats 404 as a non-error not_found result", async () => {
    mocks.fetchText.mockResolvedValueOnce(fakeSource(404));
    const budget = new RequestBudget(10);
    const result = await budget.fetch("https://example.test/gone");
    expect(result.kind).toBe("not_found");
    expect(budget.spent).toBe(1);
  });

  test("treats 429 as throttled and refuses further fetches in this run", async () => {
    mocks.fetchText.mockResolvedValueOnce(fakeSource(429));
    const budget = new RequestBudget(10);
    const first = await budget.fetch("https://example.test/a");
    expect(first.kind).toBe("rate_limited");
    expect(budget.throttled).toBe(true);
    // Subsequent calls short-circuit without hitting the network.
    const second = await budget.fetch("https://example.test/b");
    expect(second.kind).toBe("rate_limited");
    expect(mocks.fetchText).toHaveBeenCalledTimes(1);
  });

  test("throws on 5xx so the caller can decide to abort or log+continue", async () => {
    mocks.fetchText.mockResolvedValueOnce(fakeSource(503));
    const budget = new RequestBudget(10);
    await expect(budget.fetch("https://example.test/x")).rejects.toThrow(/HTTP 503/);
  });

  test("reports exhausted=true once spent hits max and skips the network", async () => {
    mocks.fetchText.mockResolvedValue(fakeSource(200));
    const budget = new RequestBudget(2);
    await budget.fetch("https://example.test/a");
    await budget.fetch("https://example.test/b");
    expect(budget.exhausted).toBe(true);
    const result = await budget.fetch("https://example.test/c");
    expect(result.kind).toBe("skipped");
    expect(mocks.fetchText).toHaveBeenCalledTimes(2);
  });

  test.each([404, 503])("paces HTTP %i responses as well as successes", async (status) => {
    const sleep = vi.spyOn(globalThis, "setTimeout");
    mocks.fetchText.mockResolvedValue(fakeSource(status));
    await new RequestBudget(10).fetch("https://example.test/a").catch(() => undefined);
    expect(sleep).toHaveBeenCalledWith(expect.any(Function), 1000);
    sleep.mockRestore();
  });

  test("does not count or sleep for budget-skipped or throttled returns", async () => {
    mocks.fetchText.mockResolvedValueOnce(fakeSource(429));
    const budget = new RequestBudget(5);
    await budget.fetch("https://example.test/a");
    expect(budget.spent).toBe(1);
    const before = budget.spent;
    await budget.fetch("https://example.test/b");
    expect(budget.spent).toBe(before);
  });
});

// Exercise the real roster parser, collector and run finalizer together.
// The persisted map survives calls to model separate scheduled processes.
describe("discussion coverage", () => {
  const times = new Map<number, string>();
  const members = [1, 2, 3].map((id) => ({
    id, username: `staff${id}`, last_posted_at: new Date(Date.now() - 60_000).toISOString()
  }));
  let rateLimitUser: number | null;
  let activityStatus: number;
  let activityBody: string;
  let rosterBody: string;
  const activityOrder = () => mocks.fetchText.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.includes("/activity.json"));
  const summary = () => mocks.finishIngestionRun.mock.calls.at(-1);

  beforeEach(() => {
    times.clear();
    rateLimitUser = null;
    activityStatus = 200;
    activityBody = '{"posts":[]}';
    rosterBody = JSON.stringify({ members, meta: { total: 3 } });
    mocks.upsertDiscoursePost.mockResolvedValue({ id: 1, wasInsert: true });
    mocks.query.mockResolvedValue({ rows: [] });
    mocks.createIngestionRun.mockResolvedValue(42);
    mocks.getDiscourseStaffPollTimes.mockImplementation(async () => new Map(times));
    mocks.markDiscourseStaffUserPolled.mockImplementation(async (_, id) => {
      times.set(id, new Date().toISOString());
    });
    mocks.getDiscoursePostFreshness.mockResolvedValue(new Map());
    mocks.recordSourceSnapshot.mockResolvedValue(1);
    mocks.markMissingDiscourseStaffUsersInactive.mockResolvedValue(0);
    mocks.fetchText.mockImplementation(async (url: string) => {
      if (url.includes("/site.json")) return fakeSource(200, '{"categories":[]}');
      if (url.includes("/members.json")) return fakeSource(200, rosterBody);
      if (rateLimitUser && url.includes(`/staff${rateLimitUser}/`)) return fakeSource(429);
      if (url.includes("/t/")) return fakeSource(429);
      return fakeSource(activityStatus, activityBody);
    });
  });

  test("a later run resumes uncompleted users before recently completed users", async () => {
    rateLimitUser = 2;
    await expect(pollDiscussions()).rejects.toThrow(/incomplete/i);
    expect(activityOrder()).toEqual([
      expect.stringContaining("/staff1/"), expect.stringContaining("/staff2/")
    ]);
    expect([...times.keys()]).toEqual([1]);
    expect(summary()?.[2]).toBe("failed");
    expect(summary()?.[3]).toMatchObject({ sourceCount: 1 });
    mocks.fetchText.mockClear();
    rateLimitUser = null;
    await pollDiscussions();
    expect(activityOrder()).toEqual([
      expect.stringContaining("/staff2/"), expect.stringContaining("/staff3/"), expect.stringContaining("/staff1/")
    ]);
    expect(summary()?.[2]).toBe("success");
    expect(summary()?.[3]).toMatchObject({ sourceCount: 3 });
  });

  test("429 on the final user still fails and does not checkpoint that user", async () => {
    rateLimitUser = 3;
    await expect(pollDiscussions()).rejects.toThrow(/incomplete/i);
    expect([...times.keys()]).toEqual([1, 2]);
    expect(summary()?.[3]).toMatchObject({ sourceCount: 2 });
  });

  test("an exhausted request budget defers users and reports failure", async () => {
    await expect(pollDiscussions(new RequestBudget(3))).rejects.toThrow(/incomplete/i);
    expect([...times.keys()]).toEqual([1]);
    expect(activityOrder()).toHaveLength(1);
  });

  test("exactly using the budget for complete coverage still succeeds", async () => {
    await pollDiscussions(new RequestBudget(5));
    expect(summary()?.[2]).toBe("success");
    expect([...times.keys()]).toEqual([1, 2, 3]);
  });

  test("per-user fetch errors fail health and leave users due for retry", async () => {
    activityStatus = 503;
    await expect(pollDiscussions()).rejects.toThrow(/incomplete/i);
    expect(times.size).toBe(0);
    expect(summary()?.[3]).toMatchObject({ sourceCount: 0 });
  });

  test("404 activity responses count as checked without deactivating staff", async () => {
    activityStatus = 404;
    await pollDiscussions();
    expect(times.size).toBe(3);
    expect(summary()?.[2]).toBe("success");
  });

  test("persisted oldest poll takes priority even if its latest post is older", async () => {
    times.set(1, "2026-05-03T00:00:00Z");
    times.set(2, "2026-05-01T00:00:00Z");
    times.set(3, "2026-05-02T00:00:00Z");
    await pollDiscussions();
    expect(activityOrder()).toEqual([
      expect.stringContaining("/staff2/"), expect.stringContaining("/staff3/"), expect.stringContaining("/staff1/")
    ]);
  });

  test.each([1500, 3])("topic interruption at request budget %i leaves the user due", async (max) => {
    rosterBody = JSON.stringify({ members: members.slice(0, 1), meta: { total: 1 } });
    activityBody = JSON.stringify({ posts: [{
      id: 99, topic_id: 10, post_number: 1, user_id: 1, username: "staff1",
      raw: "A post", cooked: "<p>A post</p>", created_at: "2026-10-07T00:00:00Z"
    }] });
    await expect(pollDiscussions(new RequestBudget(max))).rejects.toThrow(/incomplete/i);
    expect(mocks.upsertDiscoursePost).toHaveBeenCalledTimes(1);
    expect(times.size).toBe(0);
    expect(summary()?.[3]).toMatchObject({ sourceCount: 0 });
  });

  test("a short roster fails before activity or deactivation", async () => {
    rosterBody = JSON.stringify({ members: [], meta: { total: 3 } });
    await expect(pollDiscussions()).rejects.toThrow(/roster incomplete/i);
    expect(activityOrder()).toHaveLength(0);
    expect(mocks.markMissingDiscourseStaffUsersInactive).not.toHaveBeenCalled();
  });

  test("the user cap reports deferred coverage and rotates on the next run", async () => {
    const many = Array.from({ length: 601 }, (_, i) => ({ ...members[0], id: i + 1, username: `staff${i + 1}` }));
    rosterBody = JSON.stringify({ members: many, meta: { total: many.length } });
    await expect(pollDiscussions()).rejects.toThrow("600/601 users completed, 1 deferred");
    expect(times.size).toBe(600);
    mocks.fetchText.mockClear();
    await expect(pollDiscussions()).rejects.toThrow("600/601 users completed, 1 deferred");
    expect(activityOrder()[0]).toContain("/staff601/");
  });

  test("checkpoint failure keeps the run unhealthy", async () => {
    mocks.markDiscourseStaffUserPolled.mockRejectedValueOnce(new Error("DB unavailable"));
    await expect(pollDiscussions()).rejects.toThrow(/incomplete/i);
    expect([...times.keys()]).toEqual([2, 3]);
    expect(summary()?.[3]).toMatchObject({ sourceCount: 2 });
  });

  test("a throttled roster fails without falsely marking unseen users inactive", async () => {
    mocks.fetchText.mockResolvedValueOnce(fakeSource(200, '{"categories":[]}'))
      .mockResolvedValueOnce(fakeSource(429));
    await expect(pollDiscussions()).rejects.toThrow();
    expect(mocks.markMissingDiscourseStaffUsersInactive).not.toHaveBeenCalled();
    expect(times.size).toBe(0);
    expect(summary()?.[2]).toBe("failed");
  });
});
