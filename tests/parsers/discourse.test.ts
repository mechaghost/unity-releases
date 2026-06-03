import { describe, expect, test } from "vitest";

import {
  DiscourseParseError,
  parseDiscourseSite,
  parsePostDetail,
  parseStaffMembers,
  parseTopicDetail,
  parseUserActivity,
  sha256
} from "../../src/lib/parsers/discourse";

// ─── /site.json ─────────────────────────────────────────────────

const SITE_FIXTURE = JSON.stringify({
  default_locale: "en_US",
  topic_count: 100,
  categories: [
    {
      id: 47,
      slug: "input-system",
      name: "Input System",
      parent_category_id: 12,
      description: "Discuss the new Input System",
      color: "C0E0FF",
      text_color: "111111"
    },
    {
      // Missing slug - should be skipped, not crash the whole parse.
      id: 99,
      name: "broken"
    },
    {
      id: 12,
      slug: "scripting",
      name: "Scripting",
      parent_category_id: null,
      // No description here, parser should pass through as null.
      color: null,
      text_color: null
    }
  ]
});

describe("parseDiscourseSite", () => {
  test("extracts only categories that have an id + slug + name", () => {
    const result = parseDiscourseSite(SITE_FIXTURE);
    const slugs = result.categories.map((c) => c.slug);
    expect(slugs).toEqual(["input-system", "scripting"]);
  });

  test("preserves raw fields under rawMetadata for forward compat", () => {
    const result = parseDiscourseSite(SITE_FIXTURE);
    const cat = result.categories.find((c) => c.slug === "input-system");
    expect(cat?.parentDiscourseCategoryId).toBe(12);
    expect(cat?.description).toBe("Discuss the new Input System");
    expect(cat?.rawMetadata).toMatchObject({ id: 47, slug: "input-system" });
  });

  test("throws on invalid JSON", () => {
    expect(() => parseDiscourseSite("{not json")).toThrow(DiscourseParseError);
  });

  test("returns empty categories on missing key", () => {
    expect(parseDiscourseSite("{}").categories).toEqual([]);
  });
});

// ─── /groups/unity_staff/members.json ───────────────────────────

const STAFF_FIXTURE = JSON.stringify({
  members: [
    {
      id: 7001,
      username: "rene.unity",
      name: "Rene Damm",
      avatar_template: "/user_avatar/discussions.unity.com/rene.unity/{size}/2.png",
      title: "Unity Staff",
      trust_level: 4,
      primary_group_name: "unity_staff",
      flair_group_id: 41,
      last_posted_at: "2026-05-20T18:00:00Z",
      last_seen_at: "2026-05-22T09:12:00Z",
      added_at: "2017-03-04T00:00:00Z"
    },
    {
      // No id — must be dropped.
      username: "ghost",
      primary_group_name: "unity_staff"
    },
    {
      id: 7002,
      username: "ralph.unity",
      // Most fields absent - still valid; parser should null them.
      primary_group_name: "unity_staff"
    }
  ],
  meta: { total: 412, limit: 50, offset: 0 }
});

describe("parseStaffMembers", () => {
  test("drops rows missing id or username and keeps the valid ones", () => {
    const result = parseStaffMembers(STAFF_FIXTURE);
    expect(result.members.map((m) => m.username)).toEqual(["rene.unity", "ralph.unity"]);
  });

  test("propagates meta.total for the pagination walk", () => {
    expect(parseStaffMembers(STAFF_FIXTURE).total).toBe(412);
  });

  test("falls back to members.length when meta.total is missing", () => {
    const noMetaFixture = JSON.stringify({
      members: [{ id: 1, username: "a" }, { id: 2, username: "b" }]
    });
    expect(parseStaffMembers(noMetaFixture).total).toBe(2);
  });

  test("nulls absent fields rather than crashing", () => {
    const result = parseStaffMembers(STAFF_FIXTURE);
    const ralph = result.members.find((m) => m.username === "ralph.unity");
    expect(ralph?.displayName).toBeNull();
    expect(ralph?.userTitle).toBeNull();
    expect(ralph?.lastPostedAt).toBeNull();
  });

  test("normalizes added_at vs added_to_group_at to a single field", () => {
    const result = parseStaffMembers(STAFF_FIXTURE);
    const rene = result.members.find((m) => m.username === "rene.unity");
    expect(rene?.addedToGroupAt).toBe("2017-03-04T00:00:00Z");
  });
});

// ─── /posts/:id.json ────────────────────────────────────────────

const POST_DETAIL_FIXTURE = JSON.stringify({
  id: 1234567,
  topic_id: 9876,
  post_number: 3,
  topic_slug: "input-system-2-0-roadmap",
  topic_title: "Input System 2.0 Roadmap",
  user_id: 7001,
  username: "rene.unity",
  user_title: "Staff",
  primary_group_name: "unity_staff",
  flair_group_id: 41,
  staff: true,
  moderator: true,
  admin: false,
  category_id: 47,
  raw: "We are planning the 2.0 release.",
  cooked: "<p>We are planning the 2.0 release.</p>",
  excerpt: "We are planning the 2.0 release.",
  version: 2,
  edit_reason: "typo",
  created_at: "2026-05-01T10:00:00Z",
  updated_at: "2026-05-22T12:00:00Z",
  reply_count: 9,
  reads: 1023,
  score: 31.25,
  incoming_link_count: 12
});

describe("parsePostDetail", () => {
  test("returns a typed post with sha256 over the raw body", () => {
    const result = parsePostDetail(POST_DETAIL_FIXTURE);
    expect(result.discoursePostId).toBe(1234567);
    expect(result.discourseTopicId).toBe(9876);
    expect(result.postNumber).toBe(3);
    expect(result.discourseVersion).toBe(2);
    expect(result.editReason).toBe("typo");
    expect(result.rawSha256).toBe(sha256("We are planning the 2.0 release."));
  });

  test("is staff-signal-positive when staff/moderator/admin flags are set", () => {
    expect(parsePostDetail(POST_DETAIL_FIXTURE).isStaffSignal).toBe(true);
  });

  test("is staff-signal-positive when only primary_group_name says unity_staff", () => {
    const fixture = JSON.stringify({
      ...JSON.parse(POST_DETAIL_FIXTURE),
      staff: false,
      moderator: false,
      admin: false
    });
    expect(parsePostDetail(fixture).isStaffSignal).toBe(true);
  });

  test("falls back to created_at when updated_at is missing", () => {
    const fixture = JSON.stringify({
      ...JSON.parse(POST_DETAIL_FIXTURE),
      updated_at: undefined
    });
    const result = parsePostDetail(fixture);
    expect(result.discourseUpdatedAt).toBe("2026-05-01T10:00:00Z");
  });

  test("defaults discourseVersion to 1 when absent", () => {
    const fixture = JSON.stringify({ ...JSON.parse(POST_DETAIL_FIXTURE), version: undefined });
    expect(parsePostDetail(fixture).discourseVersion).toBe(1);
  });

  test("throws DiscourseParseError when required identifiers are missing", () => {
    const fixture = JSON.stringify({ raw: "hi" });
    expect(() => parsePostDetail(fixture)).toThrow(DiscourseParseError);
  });

  test("empty raw produces empty sha256 string (not the sha of empty input)", () => {
    const fixture = JSON.stringify({
      id: 1,
      topic_id: 1,
      post_number: 1,
      user_id: 1,
      username: "a",
      created_at: "2026-01-01T00:00:00Z"
    });
    expect(parsePostDetail(fixture).rawSha256).toBe("");
  });
});

// ─── /users/:username/activity.json ─────────────────────────────

describe("parseUserActivity", () => {
  test("accepts the user_actions array shape and filters to post/topic actions", () => {
    const fixture = JSON.stringify({
      user_actions: [
        { action_type: 5, ...JSON.parse(POST_DETAIL_FIXTURE) }, // post
        { action_type: 1, post: JSON.parse(POST_DETAIL_FIXTURE) }, // like - drop
        {
          action_type: 4,
          ...JSON.parse(POST_DETAIL_FIXTURE),
          id: 2222222,
          topic_id: 9877,
          post_number: 1
        }
      ]
    });
    const result = parseUserActivity(fixture);
    expect(result.posts.map((p) => p.discoursePostId)).toEqual([1234567, 2222222]);
  });

  test("accepts a bare array shape too (no top-level wrapper)", () => {
    const fixture = JSON.stringify([
      { action_type: 5, ...JSON.parse(POST_DETAIL_FIXTURE) }
    ]);
    expect(parseUserActivity(fixture).posts).toHaveLength(1);
  });

  test("skips activity rows that lack required identifiers without aborting", () => {
    const fixture = JSON.stringify({
      user_actions: [
        { action_type: 5, raw: "missing ids" },
        { action_type: 5, ...JSON.parse(POST_DETAIL_FIXTURE) }
      ]
    });
    const result = parseUserActivity(fixture);
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0]?.discoursePostId).toBe(1234567);
  });
});

// ─── /t/:topic_id.json ───────────────────────────────────────────

describe("parseTopicDetail", () => {
  test("extracts topic identifiers and normalizes tags to sorted strings", () => {
    const fixture = JSON.stringify({
      id: 9876,
      slug: "input-system-2-0-roadmap",
      title: "Input System 2.0 Roadmap",
      fancy_title: "Input System 2.0 Roadmap &amp; Plans",
      category_id: 47,
      tags: ["beta", "Input", "official", null, ""]
    });
    const result = parseTopicDetail(fixture);
    expect(result.discourseTopicId).toBe(9876);
    expect(result.topicSlug).toBe("input-system-2-0-roadmap");
    expect(result.topicTitle).toBe("Input System 2.0 Roadmap");
    expect(result.discourseCategoryId).toBe(47);
    expect(result.tags).toEqual(["Input", "beta", "official"]);
  });

  test("prefers title over fancy_title", () => {
    const fixture = JSON.stringify({
      id: 1,
      slug: "x",
      fancy_title: "&quot;Best&quot;"
    });
    expect(parseTopicDetail(fixture).topicTitle).toBe("&quot;Best&quot;");
  });

  test("throws on missing id", () => {
    expect(() => parseTopicDetail("{}")).toThrow(DiscourseParseError);
  });
});

describe("sha256", () => {
  test("returns the canonical hex of the utf-8 input", () => {
    expect(sha256("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
  });
});
