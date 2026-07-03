import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn()
}));

vi.mock("../../src/lib/db/client", () => ({
  query: mocks.query,
  getPool: vi.fn()
}));

import {
  getDiscoursePostFreshness,
  getDiscoursePostStats,
  insertDiscoursePostRevisionIfChanged,
  listDiscourseFilterFacets,
  listDiscoursePosts,
  type DiscoursePostRevisionInput
} from "../../src/lib/db/repositories";

type Row = Record<string, unknown>;
function rows<T extends Row>(...records: T[]) {
  return { rows: records, rowCount: records.length };
}

beforeEach(() => {
  mocks.query.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── getDiscoursePostFreshness ────────────────────────────────

describe("getDiscoursePostFreshness", () => {
  test("returns an empty map when no posts are tracked yet", async () => {
    mocks.query.mockResolvedValueOnce(rows());
    const freshness = await getDiscoursePostFreshness();
    expect(freshness.size).toBe(0);
  });

  test("keys the map by discourse_post_id, not the surrogate id", async () => {
    mocks.query.mockResolvedValueOnce(
      rows(
        { id: "1", discourse_post_id: "789123", discourse_version: 3, raw_sha256: "abc", discourse_updated_at: "2026-05-22T10:00:00Z" },
        { id: "2", discourse_post_id: "789456", discourse_version: 1, raw_sha256: "def", discourse_updated_at: "2026-05-21T08:30:00Z" }
      )
    );
    const freshness = await getDiscoursePostFreshness();
    expect(freshness.size).toBe(2);
    expect(freshness.get(789123)?.discourseVersion).toBe(3);
    expect(freshness.get(789456)?.rawSha256).toBe("def");
    // The surrogate pk is carried through so callers can reuse it for
    // the revision insert without a second round-trip.
    expect(freshness.get(789123)?.id).toBe(1);
  });
});

// ─── insertDiscoursePostRevisionIfChanged ──────────────────────

describe("insertDiscoursePostRevisionIfChanged", () => {
  const baseInput: DiscoursePostRevisionInput = {
    discoursePostDbId: 7,
    discoursePostId: 9001,
    discourseVersion: 2,
    raw: "Hello edited",
    rawSha256: "newhash",
    editReason: "fixed typo",
    observedUpdatedAt: "2026-05-22T10:00:00Z",
    sourceSnapshotId: 42,
    ingestionRunId: 100,
    parserVersion: "2026-05-22"
  };
  const fakeClient = { query: vi.fn() } as any;

  beforeEach(() => {
    fakeClient.query.mockReset();
  });

  test("short-circuits without a DB call when version and hash both match", async () => {
    const written = await insertDiscoursePostRevisionIfChanged(
      fakeClient,
      { discourseVersion: 2, rawSha256: "newhash" },
      baseInput
    );
    expect(written).toBe(false);
    expect(fakeClient.query).not.toHaveBeenCalled();
  });

  test("writes a revision when only the version bumped (moderation move)", async () => {
    fakeClient.query.mockResolvedValueOnce({ rowCount: 1 });
    const written = await insertDiscoursePostRevisionIfChanged(
      fakeClient,
      { discourseVersion: 1, rawSha256: "newhash" },
      baseInput
    );
    expect(written).toBe(true);
    expect(fakeClient.query).toHaveBeenCalledOnce();
  });

  test("writes a revision when only the raw_sha256 differs (silent edit)", async () => {
    fakeClient.query.mockResolvedValueOnce({ rowCount: 1 });
    const written = await insertDiscoursePostRevisionIfChanged(
      fakeClient,
      { discourseVersion: 2, rawSha256: "oldhash" },
      baseInput
    );
    expect(written).toBe(true);
  });

  test("writes a revision when there's no prior row (first-seen post)", async () => {
    fakeClient.query.mockResolvedValueOnce({ rowCount: 1 });
    const written = await insertDiscoursePostRevisionIfChanged(fakeClient, null, baseInput);
    expect(written).toBe(true);
  });

  test("returns false when the INSERT hits the unique-key conflict guard", async () => {
    // ON CONFLICT (discourse_post_id, discourse_version) DO NOTHING -
    // a concurrent ingester wrote the same revision; rowCount is 0.
    fakeClient.query.mockResolvedValueOnce({ rowCount: 0 });
    const written = await insertDiscoursePostRevisionIfChanged(
      fakeClient,
      { discourseVersion: 1, rawSha256: "oldhash" },
      baseInput
    );
    expect(written).toBe(false);
  });
});

// ─── listDiscoursePosts ───────────────────────────────────────

describe("listDiscoursePosts", () => {
  test("defaults: visible + staff-only + sort by recent activity + pagination", async () => {
    mocks.query.mockResolvedValueOnce(rows());
    await listDiscoursePosts({});
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain("dp.was_staff_at_post = true");
    expect(sql).toContain("dp.is_deleted = false");
    expect(sql).toContain("ORDER BY dp.discourse_updated_at DESC");
    // perPage + offset are the last two params.
    expect(params.at(-2)).toBe(30);
    expect(params.at(-1)).toBe(0);
  });

  test("passes q through to a websearch_to_tsquery match", async () => {
    mocks.query.mockResolvedValueOnce(rows());
    await listDiscoursePosts({ q: "input system" });
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain("websearch_to_tsquery");
    expect(params).toContain("input system");
  });

  test("ANY-matches category ids and tags arrays", async () => {
    mocks.query.mockResolvedValueOnce(rows());
    await listDiscoursePosts({ categoryIds: [12, 47], tags: ["beta", "official"] });
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain("dp.discourse_category_id = ANY(");
    expect(sql).toContain("dp.tags && ");
    expect(params).toContainEqual([12, 47]);
    expect(params).toContainEqual(["beta", "official"]);
  });

  test("editedOnly adds the last_edited_at IS NOT NULL filter", async () => {
    mocks.query.mockResolvedValueOnce(rows());
    await listDiscoursePosts({ editedOnly: true });
    const [sql] = mocks.query.mock.calls[0];
    expect(sql).toContain("dp.last_edited_at IS NOT NULL");
  });

  test("firstPostOnly restricts to topic-starter posts (post_number = 1)", async () => {
    mocks.query.mockResolvedValueOnce(rows());
    await listDiscoursePosts({ firstPostOnly: true });
    const [sql] = mocks.query.mock.calls[0];
    expect(sql).toContain("dp.post_number = 1");
  });

  test("hides automation accounts by default (issue-tracker bot)", async () => {
    mocks.query.mockResolvedValueOnce(rows());
    await listDiscoursePosts({});
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain("dp.username <> ALL(");
    expect(params).toContainEqual(["issue-tracker"]);
  });

  test("includeAutomated: true lifts the bot exclusion", async () => {
    mocks.query.mockResolvedValueOnce(rows());
    await listDiscoursePosts({ includeAutomated: true });
    const [sql] = mocks.query.mock.calls[0];
    expect(sql).not.toContain("dp.username <> ALL(");
  });

  test("an explicit author filter overrides the bot exclusion", async () => {
    // Asking for the bot by name should show the bot - the exclusion
    // only applies to the unfiltered default lens.
    mocks.query.mockResolvedValueOnce(rows());
    await listDiscoursePosts({ usernames: ["issue-tracker"] });
    const [sql, params] = mocks.query.mock.calls[0];
    expect(sql).toContain("dp.username = ANY(");
    expect(sql).not.toContain("dp.username <> ALL(");
    expect(params).toContainEqual(["issue-tracker"]);
  });

  test("sort=popular orders by reply_count, sort=edited orders by last_edited_at", async () => {
    mocks.query.mockResolvedValueOnce(rows());
    await listDiscoursePosts({ sort: "popular" });
    expect(mocks.query.mock.calls[0][0]).toContain("ORDER BY COALESCE(dp.reply_count, 0) DESC");

    mocks.query.mockReset();
    mocks.query.mockResolvedValueOnce(rows());
    await listDiscoursePosts({ sort: "edited" });
    expect(mocks.query.mock.calls[0][0]).toContain("ORDER BY dp.last_edited_at DESC");
  });

  test("clamps per_page to MAX_PER_PAGE so a hostile querystring can't page huge", async () => {
    mocks.query.mockResolvedValueOnce(rows());
    await listDiscoursePosts({ perPage: 5000 });
    expect(mocks.query.mock.calls[0][1].at(-2)).toBe(100);
  });

  test("derives postUrl from topic slug + topic id + post number", async () => {
    mocks.query.mockResolvedValueOnce(
      rows({
        total_count: "1",
        id: "1",
        discourse_post_id: "999",
        discourse_topic_id: "555",
        post_number: 3,
        topic_slug: "input-system-2-0",
        topic_title: "Input System 2.0",
        username: "rene.unity",
        user_title: "Staff",
        avatar_template: null,
        discourse_category_id: 12,
        category_name: "Input System",
        category_slug: "input-system",
        tags: ["beta", "input"],
        excerpt: "hello",
        raw: "raw body",
        discourse_created_at: "2026-05-22T00:00:00Z",
        discourse_updated_at: "2026-05-22T10:00:00Z",
        last_edited_at: null,
        edit_reason: null,
        reply_count: 2,
        incoming_link_count: 0,
        score: "12.34",
        is_deleted: false
      })
    );
    const result = await listDiscoursePosts({});
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.postUrl).toBe(
      "https://discussions.unity.com/t/input-system-2-0/555/3"
    );
    // Numeric coercion happens in the mapper - the consumer never sees BigInt strings.
    expect(result.items[0]?.discoursePostId).toBe(999);
    expect(result.items[0]?.score).toBe(12.34);
  });
});

// ─── listDiscourseFilterFacets ────────────────────────────────

describe("listDiscourseFilterFacets", () => {
  test("returns empty arrays for each axis when the table is empty", async () => {
    mocks.query.mockResolvedValue(rows());
    const facets = await listDiscourseFilterFacets();
    expect(facets.categories).toEqual([]);
    expect(facets.tags).toEqual([]);
    expect(facets.authors).toEqual([]);
  });

  test("coerces count strings to numbers per axis", async () => {
    mocks.query
      .mockResolvedValueOnce(
        rows({ discourse_category_id: 12, slug: "graphics", name: "Graphics", count: "7" })
      )
      .mockResolvedValueOnce(rows({ tag: "beta", count: "12" }))
      .mockResolvedValueOnce(
        rows({ username: "rene.unity", user_title: "Staff", count: "5" })
      );
    const facets = await listDiscourseFilterFacets();
    expect(facets.categories[0]).toEqual({
      discourseCategoryId: 12,
      slug: "graphics",
      name: "Graphics",
      count: 7
    });
    expect(facets.tags[0]).toEqual({ tag: "beta", count: 12 });
    expect(facets.authors[0]).toEqual({
      username: "rene.unity",
      userTitle: "Staff",
      count: 5
    });
  });
});

// ─── getDiscoursePostStats ─────────────────────────────────────

describe("getDiscoursePostStats", () => {
  test("returns zeros and null timestamps on an empty table", async () => {
    mocks.query.mockResolvedValueOnce(rows({}));
    const stats = await getDiscoursePostStats();
    expect(stats).toEqual({
      totalPosts: 0,
      editedPosts: 0,
      deletedPosts: 0,
      trackedStaff: 0,
      activeStaff: 0,
      trackedCategories: 0,
      latestPostAt: null
    });
  });

  test("coerces all aggregate strings to numbers", async () => {
    mocks.query.mockResolvedValueOnce(
      rows({
        total_posts: "200",
        edited_posts: "18",
        deleted_posts: "2",
        tracked_staff: "412",
        active_staff: "243",
        tracked_categories: "37",
        latest_post_at: "2026-05-22T10:00:00Z"
      })
    );
    const stats = await getDiscoursePostStats();
    expect(stats.totalPosts).toBe(200);
    expect(stats.editedPosts).toBe(18);
    expect(stats.deletedPosts).toBe(2);
    expect(stats.trackedStaff).toBe(412);
    expect(stats.activeStaff).toBe(243);
    expect(stats.trackedCategories).toBe(37);
    expect(stats.latestPostAt).toBe("2026-05-22T10:00:00.000Z");
  });
});
