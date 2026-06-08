import { describe, expect, test } from "vitest";
import { parseRepo, parseEvent, summarizeEvent, isNotable } from "@/lib/ingest/github";

describe("parseRepo", () => {
  test("maps the fields we store and flags notable repos", () => {
    const repo = parseRepo({
      id: 12345,
      name: "ml-agents",
      full_name: "Unity-Technologies/ml-agents",
      owner: { login: "Unity-Technologies" },
      description: "Train intelligent agents",
      html_url: "https://github.com/Unity-Technologies/ml-agents",
      homepage: "https://unity.com/ml-agents",
      stargazers_count: 16000,
      forks_count: 4000,
      open_issues_count: 120,
      watchers_count: 16000,
      language: "C#",
      topics: ["machine-learning", "unity"],
      license: { spdx_id: "Apache-2.0" },
      archived: false,
      fork: false,
      is_template: false,
      default_branch: "main",
      size: 90000,
      created_at: "2017-09-08T00:00:00Z",
      updated_at: "2026-06-01T00:00:00Z",
      pushed_at: "2026-06-05T00:00:00Z"
    });
    expect(repo.githubRepoId).toBe(12345);
    expect(repo.name).toBe("ml-agents");
    expect(repo.stargazersCount).toBe(16000);
    expect(repo.topics).toEqual(["machine-learning", "unity"]);
    expect(repo.licenseSpdx).toBe("Apache-2.0");
    expect(repo.isNotable).toBe(true);
    expect(repo.repoPushedAt).toBe("2026-06-05T00:00:00.000Z");
  });

  test("is defensive about missing fields", () => {
    const repo = parseRepo({ id: 1, name: "obscure-tool" });
    expect(repo.fullName).toBe("Unity-Technologies/obscure-tool");
    expect(repo.description).toBeNull();
    expect(repo.topics).toEqual([]);
    expect(repo.licenseSpdx).toBeNull();
    expect(repo.isNotable).toBe(false);
    expect(repo.repoCreatedAt).toBeNull();
  });
});

describe("isNotable", () => {
  test("matches curated repos case-insensitively", () => {
    expect(isNotable("UnityCsReference")).toBe(true);
    expect(isNotable("unitycsreference")).toBe(true);
    expect(isNotable("some-random-repo")).toBe(false);
  });
});

describe("summarizeEvent", () => {
  test("release", () => {
    expect(summarizeEvent({ type: "ReleaseEvent", payload: { release: { tag_name: "v2.1.0" } } })).toBe(
      "Released v2.1.0"
    );
  });
  test("push with branch + commit count", () => {
    expect(
      summarizeEvent({ type: "PushEvent", payload: { ref: "refs/heads/main", commits: [{}, {}, {}] } })
    ).toBe("Pushed 3 commits to main");
  });
  test("create branch and repository", () => {
    expect(summarizeEvent({ type: "CreateEvent", payload: { ref_type: "branch", ref: "release/6.0" } })).toBe(
      "Created branch release/6.0"
    );
    expect(summarizeEvent({ type: "CreateEvent", payload: { ref_type: "repository" } })).toBe(
      "Created repository"
    );
  });
  test("merged PR", () => {
    expect(
      summarizeEvent({
        type: "PullRequestEvent",
        payload: { action: "closed", number: 42, pull_request: { merged: true, number: 42 } }
      })
    ).toBe("Merged PR #42");
  });
  test("issue comment", () => {
    expect(summarizeEvent({ type: "IssueCommentEvent", payload: { issue: { number: 7 } } })).toBe(
      "Commented on #7"
    );
  });
});

describe("parseEvent", () => {
  test("drops star (Watch) events as noise", () => {
    expect(parseEvent({ id: "1", type: "WatchEvent", repo: { name: "Unity-Technologies/x" } })).toBeNull();
  });
  test("maps a release event with its html_url", () => {
    const ev = parseEvent({
      id: "99",
      type: "ReleaseEvent",
      created_at: "2026-06-05T10:00:00Z",
      repo: { id: 7, name: "Unity-Technologies/Graphics" },
      actor: { login: "unity-ci", avatar_url: "https://avatars.example/x.png" },
      payload: { release: { tag_name: "v17.0", html_url: "https://github.com/Unity-Technologies/Graphics/releases/tag/v17.0" } }
    });
    expect(ev).not.toBeNull();
    expect(ev!.githubEventId).toBe("99");
    expect(ev!.repoFullName).toBe("Unity-Technologies/Graphics");
    expect(ev!.summary).toBe("Released v17.0");
    expect(ev!.htmlUrl).toBe("https://github.com/Unity-Technologies/Graphics/releases/tag/v17.0");
    expect(ev!.eventCreatedAt).toBe("2026-06-05T10:00:00.000Z");
  });
});
