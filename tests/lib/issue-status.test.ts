import { describe, expect, test } from "vitest";

import {
  deriveIssueStatus,
  issueStatusLabel,
  issueStatusTone,
  type IssueStatusMention
} from "../../src/lib/issue-status";

const m = (
  version: string,
  section: string,
  release_date: string | null
): IssueStatusMention => ({ version, section, release_date });

describe("deriveIssueStatus", () => {
  test("returns unknown when there are no mentions", () => {
    const status = deriveIssueStatus([]);
    expect(status).toEqual({ kind: "unknown" });
    expect(issueStatusLabel(status)).toBe("Unknown");
    expect(issueStatusTone(status)).toBe("info");
  });

  test("flags resolved when only Fixes mentions exist", () => {
    const status = deriveIssueStatus([
      m("6000.0.30f1", "Fixes", "2026-04-12"),
      m("6000.0.27f1", "Fixes", "2026-03-01")
    ]);
    expect(status).toMatchObject({
      kind: "resolved",
      version: "6000.0.27f1",
      additionalFixCount: 1
    });
    expect(issueStatusTone(status)).toBe("good");
    expect(issueStatusLabel(status)).toBe("Fixed in 6000.0.27f1");
  });

  test("flags open when only Known Issues mentions exist", () => {
    const status = deriveIssueStatus([
      m("6000.1.0a3", "Known Issues", "2026-04-30"),
      m("6000.0.32f1", "Known Issues", "2026-04-20")
    ]);
    expect(status).toMatchObject({
      kind: "open",
      version: "6000.1.0a3",
      releaseDate: "2026-04-30"
    });
    expect(issueStatusTone(status)).toBe("warn");
    expect(issueStatusLabel(status)).toBe("Known issue in 6000.1.0a3");
  });

  test("treats fix as resolved when fix is newer than the last known-issue listing", () => {
    const status = deriveIssueStatus([
      m("6000.0.30f1", "Fixes", "2026-04-12"),
      m("6000.0.20f1", "Known Issues", "2026-02-01")
    ]);
    expect(status.kind).toBe("resolved");
  });

  test("flags regressed when a Known Issues mention is newer than the latest fix", () => {
    const status = deriveIssueStatus([
      m("6000.1.0a5", "Known Issues", "2026-05-01"),
      m("6000.0.30f1", "Fixes", "2026-04-12"),
      m("6000.0.27f1", "Fixes", "2026-03-01")
    ]);
    expect(status).toMatchObject({
      kind: "regressed",
      knownVersion: "6000.1.0a5",
      lastFixedVersion: "6000.0.30f1"
    });
    expect(issueStatusTone(status)).toBe("warn");
  });

  test("falls back to mentioned when only Improvements/Changes/etc. mention the issue", () => {
    const status = deriveIssueStatus([
      m("6000.0.28f1", "Improvements", "2026-03-15"),
      m("6000.0.25f1", "API Changes", "2026-02-20")
    ]);
    expect(status).toMatchObject({
      kind: "mentioned",
      version: "6000.0.28f1",
      section: "Improvements"
    });
    expect(issueStatusTone(status)).toBe("info");
    expect(issueStatusLabel(status)).toBe("Listed in 6000.0.28f1");
  });

  test("picks the earliest fix even when input order is shuffled", () => {
    const status = deriveIssueStatus([
      m("6000.0.27f1", "Fixes", "2026-03-01"),
      m("6000.0.30f1", "Fixes", "2026-04-12"),
      m("6000.0.25f1", "Fixes", "2026-02-15")
    ]);
    expect(status).toMatchObject({ kind: "resolved", version: "6000.0.25f1" });
  });

  test("prefers a dated fix over an undated fix when picking the 'first fixed in' version", () => {
    const status = deriveIssueStatus([
      m("6000.0.30f1", "Fixes", "2026-04-12"),
      m("unreleased", "Fixes", null)
    ]);
    expect(status).toMatchObject({ kind: "resolved", version: "6000.0.30f1" });
  });
});
