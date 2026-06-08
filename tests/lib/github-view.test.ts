import { describe, expect, test } from "vitest";
import {
  buildGithubHref,
  formatCompact,
  normalizeGithubSort,
  eventTypeLabel
} from "@/lib/github-view";

describe("normalizeGithubSort", () => {
  test("passes through known sorts, defaults to updated", () => {
    expect(normalizeGithubSort("newest")).toBe("newest");
    expect(normalizeGithubSort("updated")).toBe("updated");
    expect(normalizeGithubSort("forks")).toBe("forks");
    expect(normalizeGithubSort("stars")).toBe("stars");
    expect(normalizeGithubSort(undefined)).toBe("updated");
    expect(normalizeGithubSort("bogus")).toBe("updated");
  });
});

describe("buildGithubHref", () => {
  test("bare /github for empty / default (updated) state", () => {
    expect(buildGithubHref({})).toBe("/github");
    expect(buildGithubHref({ sort: "updated", page: 1 })).toBe("/github");
  });

  test("serializes only non-default filters (stars is no longer the default)", () => {
    expect(
      buildGithubHref({
        q: "netcode",
        language: "C#",
        topic: "multiplayer",
        sort: "stars",
        notable: true,
        archived: true,
        forks: true,
        page: 2
      })
    ).toBe(
      "/github?q=netcode&lang=C%23&topic=multiplayer&sort=stars&notable=1&archived=1&forks=1&page=2"
    );
  });

  test("drops page=1 and the default sort=updated", () => {
    expect(buildGithubHref({ q: "burst", sort: "updated", page: 1 })).toBe("/github?q=burst");
  });

  test("serializes non-default sorts", () => {
    expect(buildGithubHref({ sort: "forks" })).toBe("/github?sort=forks");
    expect(buildGithubHref({ sort: "stars" })).toBe("/github?sort=stars");
  });
});

describe("formatCompact", () => {
  test("formats counts", () => {
    expect(formatCompact(0)).toBe("0");
    expect(formatCompact(999)).toBe("999");
    expect(formatCompact(1234)).toBe("1.2k");
    expect(formatCompact(9999)).toBe("10k");
    expect(formatCompact(12000)).toBe("12k");
    expect(formatCompact(1_500_000)).toBe("1.5m");
  });
  test("guards bad input", () => {
    expect(formatCompact(-5)).toBe("0");
    expect(formatCompact(NaN)).toBe("0");
  });
});

describe("eventTypeLabel", () => {
  test("maps known event types", () => {
    expect(eventTypeLabel("ReleaseEvent")).toBe("Release");
    expect(eventTypeLabel("PushEvent")).toBe("Push");
    expect(eventTypeLabel("PullRequestEvent")).toBe("PR");
    expect(eventTypeLabel("IssueCommentEvent")).toBe("Comment");
  });
  test("humanizes unknown types", () => {
    expect(eventTypeLabel("GollumEvent")).toBe("Gollum");
  });
});
