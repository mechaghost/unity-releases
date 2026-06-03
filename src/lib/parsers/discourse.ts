import { createHash } from "node:crypto";

/**
 * Discourse API parsers. Every function takes the raw response body
 * (string of JSON), returns a typed object, and tolerates upstream
 * shape drift by treating missing fields as nullable. Unknown extras
 * are bundled into `rawMetadata` so we don't lose them if Discourse
 * adds a new field between Unity Releases poll runs.
 *
 * Endpoints these parse:
 * - /site.json                              → parseDiscourseSite
 * - /groups/unity_staff/members.json        → parseStaffMembers
 * - /users/:username/activity.json          → parseUserActivity (rich)
 * - /posts/:post_id.json                    → parsePostDetail
 * - /t/:topic_id.json                       → parseTopicDetail
 */

export type ParsedDiscourseCategory = {
  discourseCategoryId: number;
  slug: string;
  name: string;
  parentDiscourseCategoryId: number | null;
  description: string | null;
  color: string | null;
  textColor: string | null;
  rawMetadata: Record<string, unknown>;
};

export type ParsedDiscourseStaffMember = {
  discourseUserId: number;
  username: string;
  displayName: string | null;
  avatarTemplate: string | null;
  userTitle: string | null;
  trustLevel: number | null;
  primaryGroupName: string | null;
  flairGroupId: number | null;
  lastPostedAt: string | null;
  lastSeenAt: string | null;
  addedToGroupAt: string | null;
  rawMetadata: Record<string, unknown>;
};

export type ParsedDiscourseStaffMembersResponse = {
  members: ParsedDiscourseStaffMember[];
  total: number;
};

export type ParsedDiscoursePostSummary = {
  discoursePostId: number;
  discourseTopicId: number;
  postNumber: number;
  topicSlug: string | null;
  topicTitle: string | null;
  excerpt: string | null;
  discourseCreatedAt: string;
  discourseUpdatedAt: string | null;
};

export type ParsedDiscoursePost = {
  discoursePostId: number;
  discourseTopicId: number;
  postNumber: number;
  topicSlug: string | null;
  topicTitle: string | null;
  discourseUserId: number;
  username: string;
  userTitle: string | null;
  primaryGroupName: string | null;
  flairGroupId: number | null;
  isStaffSignal: boolean;
  discourseCategoryId: number | null;
  raw: string;
  cooked: string;
  excerpt: string | null;
  rawSha256: string;
  discourseVersion: number;
  editReason: string | null;
  discourseCreatedAt: string;
  discourseUpdatedAt: string;
  replyCount: number;
  reads: number | null;
  score: number | null;
  incomingLinkCount: number;
  rawMetadata: Record<string, unknown>;
};

export type ParsedDiscourseUserActivityResponse = {
  posts: ParsedDiscoursePost[];
};

export type ParsedDiscourseTopic = {
  discourseTopicId: number;
  topicSlug: string | null;
  topicTitle: string | null;
  discourseCategoryId: number | null;
  tags: string[];
  rawMetadata: Record<string, unknown>;
};

export class DiscourseParseError extends Error {
  readonly endpoint: string;
  constructor(endpoint: string, reason: string) {
    super(`Discourse parser ${endpoint}: ${reason}`);
    this.endpoint = endpoint;
    this.name = "DiscourseParseError";
  }
}

function parseJson(text: string, endpoint: string): unknown {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new DiscourseParseError(endpoint, `invalid JSON (${(err as Error).message})`);
  }
}

function asObject(value: unknown, endpoint: string, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DiscourseParseError(endpoint, `${label} is not an object`);
  }
  return value as Record<string, unknown>;
}

function asNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function asStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.length > 0 ? value : null;
}

function asBool(value: unknown): boolean {
  return value === true;
}

function requireNumber(value: unknown, endpoint: string, label: string): number {
  const n = asNumberOrNull(value);
  if (n === null) throw new DiscourseParseError(endpoint, `missing required number ${label}`);
  return n;
}

function requireString(value: unknown, endpoint: string, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new DiscourseParseError(endpoint, `missing required string ${label}`);
  }
  return value;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

// ─── /site.json ────────────────────────────────────────────────

export function parseDiscourseSite(text: string): {
  categories: ParsedDiscourseCategory[];
} {
  const root = asObject(parseJson(text, "site"), "site", "root");
  const rawCategories = Array.isArray(root.categories) ? (root.categories as unknown[]) : [];
  const categories: ParsedDiscourseCategory[] = [];
  for (const item of rawCategories) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const idValue = asNumberOrNull(c.id);
    const slug = asStringOrNull(c.slug);
    const name = asStringOrNull(c.name);
    if (idValue === null || !slug || !name) continue;
    categories.push({
      discourseCategoryId: idValue,
      slug,
      name,
      parentDiscourseCategoryId: asNumberOrNull(c.parent_category_id),
      description: asStringOrNull(c.description) ?? asStringOrNull(c.description_text),
      color: asStringOrNull(c.color),
      textColor: asStringOrNull(c.text_color),
      rawMetadata: c
    });
  }
  return { categories };
}

// ─── /groups/unity_staff/members.json ──────────────────────────

export function parseStaffMembers(text: string): ParsedDiscourseStaffMembersResponse {
  const root = asObject(parseJson(text, "staff-members"), "staff-members", "root");
  const rawMembers = Array.isArray(root.members) ? (root.members as unknown[]) : [];
  // Discourse usually nests pagination as `meta: { total: N }`. Defend
  // against absent or non-numeric values.
  const meta = (root.meta as Record<string, unknown> | undefined) ?? {};
  const total = asNumberOrNull(meta.total) ?? rawMembers.length;
  const members: ParsedDiscourseStaffMember[] = [];
  for (const item of rawMembers) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const id = asNumberOrNull(m.id);
    const username = asStringOrNull(m.username);
    if (id === null || !username) continue;
    members.push({
      discourseUserId: id,
      username,
      displayName: asStringOrNull(m.name),
      avatarTemplate: asStringOrNull(m.avatar_template),
      userTitle: asStringOrNull(m.title),
      trustLevel: asNumberOrNull(m.trust_level),
      primaryGroupName: asStringOrNull(m.primary_group_name),
      flairGroupId: asNumberOrNull(m.flair_group_id),
      lastPostedAt: asStringOrNull(m.last_posted_at),
      lastSeenAt: asStringOrNull(m.last_seen_at),
      addedToGroupAt: asStringOrNull(m.added_at) ?? asStringOrNull(m.added_to_group_at),
      rawMetadata: m
    });
  }
  return { members, total };
}

// ─── /posts/:id.json ───────────────────────────────────────────

export function parsePostDetail(text: string): ParsedDiscoursePost {
  const root = asObject(parseJson(text, "post-detail"), "post-detail", "root");
  return rowToParsedPost(root, "post-detail");
}

// ─── /users/:username/activity.json ────────────────────────────
// Activity endpoints can shape themselves a couple of ways: a bare
// array of actions, an object with `user_actions`, or an object with
// `posts`. We accept any.

export function parseUserActivity(text: string): ParsedDiscourseUserActivityResponse {
  const root = parseJson(text, "user-activity");
  let actions: unknown[] = [];
  if (Array.isArray(root)) {
    actions = root;
  } else if (root && typeof root === "object") {
    const obj = root as Record<string, unknown>;
    if (Array.isArray(obj.user_actions)) actions = obj.user_actions as unknown[];
    else if (Array.isArray(obj.posts)) actions = obj.posts as unknown[];
  }
  const posts: ParsedDiscoursePost[] = [];
  for (const action of actions) {
    if (!action || typeof action !== "object") continue;
    // Discourse uses action_type=5 (POST) and =4 (NEW_TOPIC). Both
    // are author-authored content. Skip likes (1), bookmarks (3),
    // etc. If action_type is absent (e.g. /posts.json shape), accept.
    const a = action as Record<string, unknown>;
    const actionType = asNumberOrNull(a.action_type);
    if (actionType !== null && actionType !== 4 && actionType !== 5) continue;
    try {
      posts.push(rowToParsedPost(a, "user-activity"));
    } catch {
      // Skip rows that don't have the minimum required identifiers;
      // a single malformed activity entry shouldn't kill the run.
      continue;
    }
  }
  return { posts };
}

// ─── /t/:topic_id.json ─────────────────────────────────────────

export function parseTopicDetail(text: string): ParsedDiscourseTopic {
  const root = asObject(parseJson(text, "topic-detail"), "topic-detail", "root");
  const id = requireNumber(root.id, "topic-detail", "id");
  const rawTags = Array.isArray(root.tags) ? (root.tags as unknown[]) : [];
  const tags = rawTags
    .filter((t): t is string => typeof t === "string" && t.length > 0)
    .sort();
  return {
    discourseTopicId: id,
    topicSlug: asStringOrNull(root.slug),
    topicTitle: asStringOrNull(root.title) ?? asStringOrNull(root.fancy_title),
    discourseCategoryId: asNumberOrNull(root.category_id),
    tags,
    rawMetadata: root
  };
}

// ─── shared post-row mapper ────────────────────────────────────

function rowToParsedPost(row: Record<string, unknown>, endpoint: string): ParsedDiscoursePost {
  // Activity-endpoint rows nest the post under `post`. Detail-endpoint
  // rows are themselves the post payload.
  const post =
    row.post && typeof row.post === "object" && !Array.isArray(row.post)
      ? (row.post as Record<string, unknown>)
      : row;
  const postId = requireNumber(post.id, endpoint, "post.id");
  const raw = typeof post.raw === "string" ? post.raw : "";
  return {
    discoursePostId: postId,
    discourseTopicId: requireNumber(post.topic_id, endpoint, "post.topic_id"),
    postNumber: requireNumber(post.post_number, endpoint, "post.post_number"),
    topicSlug: asStringOrNull(post.topic_slug),
    topicTitle: asStringOrNull(post.topic_title) ?? asStringOrNull(row.title),
    discourseUserId: requireNumber(post.user_id, endpoint, "post.user_id"),
    username: requireString(post.username, endpoint, "post.username"),
    userTitle: asStringOrNull(post.user_title),
    primaryGroupName: asStringOrNull(post.primary_group_name),
    flairGroupId: asNumberOrNull(post.flair_group_id),
    isStaffSignal:
      asBool(post.staff) ||
      asBool(post.moderator) ||
      asBool(post.admin) ||
      asStringOrNull(post.primary_group_name) === "unity_staff",
    discourseCategoryId: asNumberOrNull(post.category_id),
    raw,
    cooked: typeof post.cooked === "string" ? post.cooked : "",
    excerpt: asStringOrNull(post.excerpt) ?? asStringOrNull(row.excerpt),
    rawSha256: raw.length > 0 ? sha256(raw) : "",
    discourseVersion: asNumberOrNull(post.version) ?? 1,
    editReason: asStringOrNull(post.edit_reason),
    discourseCreatedAt: requireString(post.created_at, endpoint, "post.created_at"),
    discourseUpdatedAt:
      asStringOrNull(post.updated_at) ?? requireString(post.created_at, endpoint, "post.created_at"),
    replyCount: asNumberOrNull(post.reply_count) ?? 0,
    reads: asNumberOrNull(post.reads),
    score: asNumberOrNull(post.score),
    incomingLinkCount: asNumberOrNull(post.incoming_link_count) ?? 0,
    rawMetadata: post
  };
}
