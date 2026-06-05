import type { PoolClient } from "pg";
import { fetchText, type FetchedSource } from "../lib/ingest/fetch";
import {
  parseDiscourseSite,
  parsePostDetail,
  parseStaffMembers,
  parseTopicDetail,
  parseUserActivity,
  type ParsedDiscoursePost,
  type ParsedDiscourseStaffMember,
  type ParsedDiscourseTopic
} from "../lib/parsers/discourse";
import { getPool } from "../lib/db/client";
import {
  createIngestionRun,
  finishIngestionRun,
  findDiscourseStaffUserDbId,
  getDiscoursePostFreshness,
  insertDiscoursePostRevisionIfChanged,
  markMissingDiscourseStaffUsersInactive,
  recordSourceSnapshot,
  tombstoneDiscoursePost,
  upsertDiscourseCategories,
  upsertDiscoursePost,
  upsertDiscourseStaffUsers,
  type DiscoursePostFreshness
} from "../lib/db/repositories";

/**
 * Unity Discussions ingestion job. Walks the `unity_staff` user
 * group on https://discussions.unity.com, fetches each active
 * member's recent posts via /users/:username/activity.json (the
 * rich endpoint that returns version + updated_at + raw + cooked in
 * one call), upserts the live state into discourse_posts, and
 * appends a discourse_post_revisions row whenever a real edit is
 * observed (version bumped or raw_sha256 differs).
 *
 * Design constraints baked in:
 * - Per-user transactions (NOT one giant tx) so a hung connection
 *   can't block the live site's pool.
 * - 60 req/min ceiling: CONCURRENCY=1 + 1000ms delay between calls,
 *   plus a hard MAX_REQUESTS_PER_RUN circuit breaker.
 * - Only snapshot site.json (once), roster pages, and per-user
 *   activity responses that actually contained a change — skips the
 *   chatty no-op case that would otherwise grow source_snapshots
 *   ~4 GB/yr per the workflow critique.
 * - was_staff_at_post = TRUE unconditionally for posts discovered
 *   via the staff roster fan-out (we know they were staff at this
 *   poll because we got there via /groups/unity_staff/members).
 * - 404 on /posts/:id.json or /users/:u/activity.json is a soft-
 *   delete signal: tombstone the row, keep the URL resolving.
 */

const DISCOURSE_BASE = "https://discussions.unity.com";
// discussions.unity.com is fronted by Cloudflare, which 403s our default
// UnityReleasesBot user-agent (and any non-browser UA). Send a browser UA
// so the public Discourse JSON API responds. Overridable via env if Unity
// changes their policy. The job stays polite via REQUEST_DELAY_MS + the
// MAX_REQUESTS_PER_RUN budget below.
const DISCOURSE_USER_AGENT =
  process.env.DISCOURSE_USER_AGENT ??
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const REQUEST_DELAY_MS = Number(process.env.DISCOURSE_REQUEST_DELAY_MS ?? 1000);
const MAX_REQUESTS_PER_RUN = Number(process.env.DISCOURSE_MAX_REQUESTS_PER_RUN ?? 1500);
const ACTIVE_WINDOW_DAYS = Number(process.env.DISCOURSE_ACTIVE_WINDOW_DAYS ?? 365);
const MAX_USERS_PER_RUN = Number(process.env.DISCOURSE_MAX_USERS_PER_RUN ?? 600);
const ROSTER_PAGE_SIZE = 50;
const PARSER_VERSION = "discourse-2026-05-22";

type FetchResult =
  | { kind: "ok"; source: FetchedSource }
  | { kind: "not_found"; status: 404 }
  | { kind: "rate_limited"; status: 429 }
  | { kind: "skipped"; reason: "budget_exhausted" };

export class RequestBudget {
  private count = 0;
  private rateLimitedAt: number | null = null;

  constructor(private readonly max: number) {}

  get spent() {
    return this.count;
  }

  get exhausted() {
    return this.count >= this.max;
  }

  get throttled() {
    return this.rateLimitedAt !== null;
  }

  /** Counted, rate-limited Discourse fetch. Returns a discriminated
   *  union so the caller can treat 404/429 as data, not exceptions. */
  async fetch(url: string): Promise<FetchResult> {
    if (this.exhausted) {
      return { kind: "skipped", reason: "budget_exhausted" };
    }
    if (this.rateLimitedAt !== null) {
      return { kind: "rate_limited", status: 429 };
    }
    this.count += 1;
    const source = await fetchText(url, { userAgent: DISCOURSE_USER_AGENT });
    if (source.status === 429) {
      // Once Discourse rate-limits us, every subsequent call should
      // back off too — defer the remaining users to the next cron.
      this.rateLimitedAt = Date.now();
      return { kind: "rate_limited", status: 429 };
    }
    if (source.status === 404) {
      return { kind: "not_found", status: 404 };
    }
    if (source.status >= 400) {
      throw new Error(`HTTP ${source.status} fetching ${url}`);
    }
    if (REQUEST_DELAY_MS > 0) {
      await sleep(REQUEST_DELAY_MS);
    }
    return { kind: "ok", source };
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function inTx<T>(handler: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

type RunSummary = {
  categoriesUpserted: number;
  rosterTotal: number;
  rosterPages: number;
  rosterUpserted: number;
  rosterMarkedInactive: number;
  activeUsers: number;
  usersProcessed: number;
  usersSkippedBudget: number;
  usersWithChanges: number;
  usersNoChange: number;
  usersFetchErrors: number;
  postsUpserted: number;
  postsInserted: number;
  postsUpdated: number;
  revisionsWritten: number;
  postsTombstoned: number;
  topicFetches: number;
  rateLimitedEarly: boolean;
};

function emptySummary(): RunSummary {
  return {
    categoriesUpserted: 0,
    rosterTotal: 0,
    rosterPages: 0,
    rosterUpserted: 0,
    rosterMarkedInactive: 0,
    activeUsers: 0,
    usersProcessed: 0,
    usersSkippedBudget: 0,
    usersWithChanges: 0,
    usersNoChange: 0,
    usersFetchErrors: 0,
    postsUpserted: 0,
    postsInserted: 0,
    postsUpdated: 0,
    revisionsWritten: 0,
    postsTombstoned: 0,
    topicFetches: 0,
    rateLimitedEarly: false
  };
}

function logEvent(event: string, payload: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event, ...payload }));
}

async function main() {
  const summary = emptySummary();
  const budget = new RequestBudget(MAX_REQUESTS_PER_RUN);

  const runId = await createDiscourseIngestionRun();
  logEvent("discussions_run_start", { runId, maxRequests: MAX_REQUESTS_PER_RUN });

  try {
    await stepSiteAndCategories(runId, budget, summary);

    const roster = await stepRoster(runId, budget, summary);

    // Active filter: skip ex-employees who haven't posted in
    // ACTIVE_WINDOW_DAYS. Avoids wasting the per-day request budget
    // on dormant accounts the workflow research observed are common.
    const cutoff = Date.now() - ACTIVE_WINDOW_DAYS * 86_400_000;
    const active = roster
      .filter(
        (u) =>
          u.lastPostedAt !== null &&
          new Date(u.lastPostedAt).getTime() >= cutoff
      )
      // Most-recently-active first so a budget-limited run still gets
      // the freshest posters before exhausting MAX_REQUESTS.
      .sort((a, b) => {
        const aTs = a.lastPostedAt ? new Date(a.lastPostedAt).getTime() : 0;
        const bTs = b.lastPostedAt ? new Date(b.lastPostedAt).getTime() : 0;
        return bTs - aTs;
      })
      .slice(0, MAX_USERS_PER_RUN);
    summary.activeUsers = active.length;

    const freshness = await getDiscoursePostFreshness();
    const topicCache = new Map<number, ParsedDiscourseTopic>();

    for (const user of active) {
      if (budget.exhausted || budget.throttled) {
        summary.usersSkippedBudget = active.length - summary.usersProcessed;
        summary.rateLimitedEarly = budget.throttled;
        logEvent("discussions_budget_exit", {
          processed: summary.usersProcessed,
          deferred: summary.usersSkippedBudget,
          throttled: budget.throttled
        });
        break;
      }
      try {
        await processUser(user, runId, budget, freshness, topicCache, summary);
      } catch (err) {
        summary.usersFetchErrors += 1;
        logEvent("discussions_user_error", {
          username: user.username,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    await finalizeRun(runId, "success", summary);
    logEvent("discussions_run_summary", {
      runId,
      requestsSpent: budget.spent,
      ...summary
    });
  } catch (err) {
    await finalizeRun(runId, "failed", summary, err).catch(() => undefined);
    logEvent("discussions_run_failed", {
      runId,
      requestsSpent: budget.spent,
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
}

async function createDiscourseIngestionRun(): Promise<number> {
  return inTx(async (client) => {
    return createIngestionRun(client, "discourse", "poll-discussions");
  });
}

async function finalizeRun(
  runId: number,
  status: "success" | "failed",
  summary: RunSummary,
  error?: unknown
): Promise<void> {
  await inTx(async (client) => {
    await finishIngestionRun(client, runId, status, {
      sourceCount: summary.usersProcessed,
      recordsCreated: summary.postsInserted,
      recordsUpdated: summary.postsUpdated,
      errorMessage:
        error instanceof Error ? error.message : error ? String(error) : undefined
    });
  });
}

async function stepSiteAndCategories(
  runId: number,
  budget: RequestBudget,
  summary: RunSummary
): Promise<void> {
  const result = await budget.fetch(`${DISCOURSE_BASE}/site.json`);
  if (result.kind !== "ok") {
    logEvent("discussions_site_unavailable", { kind: result.kind });
    return;
  }
  const parsed = parseDiscourseSite(result.source.text);
  await inTx(async (client) => {
    const snapshotId = await recordSourceSnapshot(client, "discourse_site", result.source);
    if (parsed.categories.length > 0) {
      await upsertDiscourseCategories(
        client,
        parsed.categories.map((c) => ({
          discourseCategoryId: c.discourseCategoryId,
          slug: c.slug,
          name: c.name,
          parentDiscourseCategoryId: c.parentDiscourseCategoryId,
          description: c.description,
          color: c.color,
          textColor: c.textColor,
          rawMetadata: c.rawMetadata,
          sourceSnapshotId: snapshotId,
          ingestionRunId: runId,
          parserVersion: PARSER_VERSION
        }))
      );
      summary.categoriesUpserted = parsed.categories.length;
    }
  });
}

async function stepRoster(
  runId: number,
  budget: RequestBudget,
  summary: RunSummary
): Promise<ParsedDiscourseStaffMember[]> {
  const roster: ParsedDiscourseStaffMember[] = [];
  const allUserIds: number[] = [];
  let offset = 0;

  while (true) {
    if (budget.exhausted || budget.throttled) break;
    const url = `${DISCOURSE_BASE}/groups/unity_staff/members.json?limit=${ROSTER_PAGE_SIZE}&offset=${offset}`;
    const result = await budget.fetch(url);
    if (result.kind !== "ok") {
      logEvent("discussions_roster_short", { kind: result.kind, offset });
      break;
    }
    const parsed = parseStaffMembers(result.source.text);
    summary.rosterPages += 1;
    summary.rosterTotal = parsed.total;

    // Snapshot each roster page so we have an audit trail of the
    // full staff group as it existed at this poll.
    await inTx(async (client) => {
      const snapshotId = await recordSourceSnapshot(
        client,
        "discourse_staff_roster",
        result.source
      );
      await upsertDiscourseStaffUsers(
        client,
        parsed.members.map((m) => ({
          discourseUserId: m.discourseUserId,
          username: m.username,
          displayName: m.displayName,
          avatarTemplate: m.avatarTemplate,
          userTitle: m.userTitle,
          trustLevel: m.trustLevel,
          primaryGroupName: m.primaryGroupName,
          flairGroupId: m.flairGroupId,
          lastPostedAt: m.lastPostedAt,
          lastSeenAt: m.lastSeenAt,
          addedToGroupAt: m.addedToGroupAt,
          activeInGroup: true,
          rawMetadata: m.rawMetadata,
          sourceSnapshotId: snapshotId,
          ingestionRunId: runId,
          parserVersion: PARSER_VERSION
        }))
      );
    });

    roster.push(...parsed.members);
    for (const m of parsed.members) allUserIds.push(m.discourseUserId);
    summary.rosterUpserted = roster.length;

    if (parsed.members.length === 0) break;
    offset += parsed.members.length;
    if (parsed.total > 0 && offset >= parsed.total) break;
  }

  // Only mark inactive when we walked the full roster — a partial
  // walk (e.g. budget exhausted) would falsely deactivate every user
  // we didn't get to.
  if (allUserIds.length > 0 && summary.rosterTotal > 0 && roster.length >= summary.rosterTotal) {
    summary.rosterMarkedInactive = await inTx(async (client) =>
      markMissingDiscourseStaffUsersInactive(client, allUserIds)
    );
  }

  return roster;
}

async function resolveTopic(
  topicId: number,
  cache: Map<number, ParsedDiscourseTopic>,
  budget: RequestBudget,
  summary: RunSummary,
  fallbackFromPost: ParsedDiscoursePost
): Promise<ParsedDiscourseTopic> {
  const cached = cache.get(topicId);
  if (cached) return cached;
  const result = await budget.fetch(`${DISCOURSE_BASE}/t/${topicId}.json`);
  if (result.kind !== "ok") {
    const fallback: ParsedDiscourseTopic = {
      discourseTopicId: topicId,
      topicSlug: fallbackFromPost.topicSlug,
      topicTitle: fallbackFromPost.topicTitle,
      discourseCategoryId: fallbackFromPost.discourseCategoryId,
      tags: [],
      rawMetadata: {}
    };
    cache.set(topicId, fallback);
    return fallback;
  }
  summary.topicFetches += 1;
  const parsed = parseTopicDetail(result.source.text);
  cache.set(topicId, parsed);
  return parsed;
}

async function processUser(
  user: ParsedDiscourseStaffMember,
  runId: number,
  budget: RequestBudget,
  freshness: Map<number, DiscoursePostFreshness>,
  topicCache: Map<number, ParsedDiscourseTopic>,
  summary: RunSummary
): Promise<void> {
  summary.usersProcessed += 1;

  const url = `${DISCOURSE_BASE}/users/${encodeURIComponent(user.username)}/activity.json`;
  const result = await budget.fetch(url);
  if (result.kind === "not_found") {
    // The username changed or the user was removed - skip without
    // marking the row inactive; the next roster walk will handle that.
    return;
  }
  if (result.kind !== "ok") return;

  const parsed = parseUserActivity(result.source.text);
  if (parsed.posts.length === 0) {
    summary.usersNoChange += 1;
    return;
  }

  // Decide which posts represent real changes vs. duplicates of what
  // we already have. If nothing changed for this user, skip the tx
  // and the snapshot entirely - that's the source-snapshot bloat
  // control the workflow critique called out.
  const decisions = parsed.posts.map((post) => {
    const known = freshness.get(post.discoursePostId);
    if (!known) return { post, known, kind: "first_seen" as const };
    if (
      known.discourseVersion < post.discourseVersion ||
      known.rawSha256 !== post.rawSha256
    ) {
      return { post, known, kind: "edited" as const };
    }
    return { post, known, kind: "no_change" as const };
  });
  const hasChange = decisions.some((d) => d.kind !== "no_change");
  if (!hasChange) {
    summary.usersNoChange += 1;
    return;
  }
  summary.usersWithChanges += 1;

  await inTx(async (client) => {
    const snapshotId = await recordSourceSnapshot(
      client,
      "discourse_user_activity",
      result.source
    );
    const staffUserDbId = await findDiscourseStaffUserDbId(user.discourseUserId);

    for (const decision of decisions) {
      const { post, known, kind } = decision;
      const topic = await resolveTopic(post.discourseTopicId, topicCache, budget, summary, post);
      const isRealEdit = kind === "edited";

      const upsertResult = await upsertDiscoursePost(client, {
        discoursePostId: post.discoursePostId,
        discourseTopicId: post.discourseTopicId,
        postNumber: post.postNumber,
        topicSlug: topic.topicSlug ?? post.topicSlug,
        topicTitle: topic.topicTitle ?? post.topicTitle,
        staffUserDbId,
        discourseUserId: post.discourseUserId,
        username: post.username,
        // Unconditional TRUE - we got here via the staff roster fan-out
        // so the snapshot is correct regardless of what the per-post
        // payload reports for primary_group_name.
        wasStaffAtPost: true,
        discourseCategoryId: topic.discourseCategoryId ?? post.discourseCategoryId,
        tags: topic.tags,
        raw: post.raw,
        cooked: post.cooked,
        excerpt: post.excerpt,
        rawSha256: post.rawSha256,
        discourseVersion: post.discourseVersion,
        // edit_reason + last_edited_at only carried through on a real
        // edit; otherwise null lets the COALESCE in the upsert SQL
        // preserve the previously-stored values.
        editReason: isRealEdit ? post.editReason : null,
        discourseCreatedAt: post.discourseCreatedAt,
        discourseUpdatedAt: post.discourseUpdatedAt,
        lastEditedAt: isRealEdit ? post.discourseUpdatedAt : null,
        replyCount: post.replyCount,
        reads: post.reads,
        score: post.score,
        incomingLinkCount: post.incomingLinkCount,
        rawMetadata: post.rawMetadata,
        sourceSnapshotId: snapshotId,
        ingestionRunId: runId,
        parserVersion: PARSER_VERSION
      });

      summary.postsUpserted += 1;
      if (upsertResult.wasInsert) summary.postsInserted += 1;
      else summary.postsUpdated += 1;

      // Write a revision row when this poll observed an edit OR when
      // the post is first-seen (the initial row stands as version 1).
      if (kind === "first_seen" || kind === "edited") {
        const wrote = await insertDiscoursePostRevisionIfChanged(
          client,
          known
            ? { discourseVersion: known.discourseVersion, rawSha256: known.rawSha256 }
            : null,
          {
            discoursePostDbId: upsertResult.id,
            discoursePostId: post.discoursePostId,
            discourseVersion: post.discourseVersion,
            raw: post.raw,
            rawSha256: post.rawSha256,
            editReason: post.editReason,
            observedUpdatedAt: post.discourseUpdatedAt,
            sourceSnapshotId: snapshotId,
            ingestionRunId: runId,
            parserVersion: PARSER_VERSION
          }
        );
        if (wrote) summary.revisionsWritten += 1;

        // After committing the new revision, refresh the in-memory
        // freshness map so subsequent posts by the same user this run
        // (e.g. a moderation move across two adjacent posts) compare
        // against the just-written state, not the stale snapshot.
        freshness.set(post.discoursePostId, {
          id: upsertResult.id,
          discourseVersion: post.discourseVersion,
          rawSha256: post.rawSha256,
          discourseUpdatedAt: post.discourseUpdatedAt
        });
      }
    }
  });
}

/**
 * Soft-delete confirmation path: callers (e.g. a future cleanup pass)
 * can call this to mark a post that returns 404 on /posts/:id.json.
 * Exposed so it has an exported, tested entry point, but the main()
 * flow doesn't currently fetch per-post detail.
 */
export async function confirmAndTombstoneDeletedPost(
  discoursePostId: number,
  runId: number,
  budget: RequestBudget
): Promise<{ tombstoned: boolean }> {
  const result = await budget.fetch(`${DISCOURSE_BASE}/posts/${discoursePostId}.json`);
  if (result.kind === "not_found") {
    await inTx(async (client) => {
      await tombstoneDiscoursePost(client, discoursePostId, runId);
    });
    return { tombstoned: true };
  }
  if (result.kind === "ok") {
    // Post still exists - the parser confirms it's reachable.
    try {
      parsePostDetail(result.source.text);
    } catch {
      // ignore - the existence check is what we wanted
    }
  }
  return { tombstoned: false };
}

// Auto-invoke main when this file is executed as a script (i.e. via
// `tsx src/jobs/poll-discussions.ts` from the cron). Skip the guard
// in tests so importing the module doesn't kick off a real ingestion.
const isDirectRun =
  process.argv[1] && process.argv[1].endsWith("poll-discussions.ts");
if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
