import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("../../src/lib/db/client", () => ({
  query: mocks.query,
  getPool: vi.fn()
}));

import { listGithubRepos, listGithubEvents, getReposLatestActivity } from "../../src/lib/db/repositories";

function rows(...records: Array<Record<string, unknown>>) {
  return { rows: records, rowCount: records.length };
}

beforeEach(() => {
  mocks.query.mockReset();
});

describe("listGithubRepos", () => {
  test("hides archived + forks by default and sorts by stars", async () => {
    mocks.query.mockResolvedValueOnce(rows());
    await listGithubRepos({});
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain("gr.is_archived = false");
    expect(sql).toContain("gr.is_fork = false");
    expect(sql).toContain("ORDER BY gr.stargazers_count DESC");
    // default per-page + offset are the last two params
    expect(params.at(-2)).toBe(30);
    expect(params.at(-1)).toBe(0);
  });

  test("includeArchived / includeForks drop those filters", async () => {
    mocks.query.mockResolvedValueOnce(rows());
    await listGithubRepos({ includeArchived: true, includeForks: true });
    const [sql] = mocks.query.mock.calls[0];
    expect(sql).not.toContain("gr.is_archived = false");
    expect(sql).not.toContain("gr.is_fork = false");
  });

  test("notableOnly, language, topic, and q add their predicates", async () => {
    mocks.query.mockResolvedValueOnce(rows());
    await listGithubRepos({ notableOnly: true, language: "C#", topic: "multiplayer", q: "netcode" });
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain("gr.is_notable = true");
    expect(sql).toContain("gr.language = $");
    expect(sql).toContain("= ANY(gr.topics)");
    expect(sql).toContain("websearch_to_tsquery");
    expect(params).toContain("C#");
    expect(params).toContain("multiplayer");
    expect(params).toContain("netcode");
  });

  test("sort=newest orders by created, updated by pushed, forks by forks", async () => {
    mocks.query.mockResolvedValueOnce(rows());
    await listGithubRepos({ sort: "newest" });
    expect(mocks.query.mock.calls[0][0]).toContain("ORDER BY gr.repo_created_at DESC");

    mocks.query.mockResolvedValueOnce(rows());
    await listGithubRepos({ sort: "updated" });
    expect(mocks.query.mock.calls[1][0]).toContain("ORDER BY gr.repo_pushed_at DESC");

    mocks.query.mockResolvedValueOnce(rows());
    await listGithubRepos({ sort: "forks" });
    expect(mocks.query.mock.calls[2][0]).toContain("ORDER BY gr.forks_count DESC");
  });
});

describe("listGithubEvents", () => {
  test("excludes dependency-bot noise but keeps releases", async () => {
    mocks.query.mockResolvedValueOnce(rows());
    await listGithubEvents(40);
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain("event_type = 'ReleaseEvent'");
    expect(sql).toContain("actor_login NOT ILIKE '%[bot]%'");
    expect(params).toContain(40);
  });
});

describe("getReposLatestActivity", () => {
  test("returns empty map for no repos without querying", async () => {
    const map = await getReposLatestActivity([]);
    expect(map.size).toBe(0);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  test("merges latest push commit + latest release per repo", async () => {
    // First query() = pushes, second = releases (Promise.all order).
    mocks.query
      .mockResolvedValueOnce(
        rows({ repo_full_name: "Unity-Technologies/Graphics", head_commit_message: "Fix race", event_created_at: "2026-06-06T00:00:00Z" })
      )
      .mockResolvedValueOnce(
        rows({ repo_full_name: "Unity-Technologies/Graphics", ref: "v17.0", html_url: "https://github.com/x/releases/v17.0" })
      );
    const map = await getReposLatestActivity(["Unity-Technologies/Graphics"]);
    const a = map.get("Unity-Technologies/Graphics");
    expect(a?.commitMessage).toBe("Fix race");
    expect(a?.releaseTag).toBe("v17.0");
    expect(a?.releaseUrl).toBe("https://github.com/x/releases/v17.0");
    // The push query targets PushEvents, the release query ReleaseEvents.
    expect(mocks.query.mock.calls[0][0]).toContain("event_type = 'PushEvent'");
    expect(mocks.query.mock.calls[1][0]).toContain("event_type = 'ReleaseEvent'");
  });
});
