import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchText: vi.fn()
}));

vi.mock("../../src/lib/ingest/fetch", () => ({
  fetchText: mocks.fetchText,
  DEFAULT_USER_AGENT: "test-ua"
}));

import { RequestBudget } from "../../src/jobs/poll-discussions";

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
