/**
 * GitHub API client + parsers for the Unity-Technologies public org.
 *
 * Pure parse helpers (parseRepo, parseEvent, summarizeEvent, isNotable)
 * are unit-tested without the network. The fetch helpers use the global
 * fetch and honor GITHUB_TOKEN for the 5000 req/hr authenticated limit
 * (vs 60 unauthenticated).
 */

export const GITHUB_API = "https://api.github.com";
export const GITHUB_ORG = "Unity-Technologies";
export const GITHUB_ORG_URL = `https://github.com/${GITHUB_ORG}`;

const USER_AGENT = "UnityReleasesBot/0.1 (+https://github.com/mechaghost/unity-releases)";

/** Hand-curated highlight repos (matched case-insensitively by repo name).
 *  Unmatched entries are harmless no-ops, so this can drift ahead of the
 *  org without breaking ingestion. Edit to taste. */
export const NOTABLE_REPOS: readonly string[] = [
  "ml-agents",
  "UnityCsReference",
  "Graphics",
  "EntityComponentSystemSamples",
  "com.unity.netcode.gameobjects",
  "multiplayer-community-contributions",
  "arfoundation-samples",
  "VisualEffectGraph-Samples",
  "NavMeshComponents",
  "FPSSample",
  "BoatAttack",
  "2d-extras",
  "UnityRenderStreaming",
  "InputSystem",
  "ProjectTiny"
];

const NOTABLE_SET = new Set(NOTABLE_REPOS.map((n) => n.toLowerCase()));

export function isNotable(repoName: string): boolean {
  return NOTABLE_SET.has(repoName.toLowerCase());
}

export type GithubRepoInput = {
  githubRepoId: number;
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  htmlUrl: string;
  homepage: string | null;
  stargazersCount: number;
  forksCount: number;
  openIssuesCount: number;
  watchersCount: number;
  language: string | null;
  topics: string[];
  licenseSpdx: string | null;
  isArchived: boolean;
  isFork: boolean;
  isTemplate: boolean;
  defaultBranch: string | null;
  sizeKb: number | null;
  isNotable: boolean;
  repoCreatedAt: string | null;
  repoUpdatedAt: string | null;
  repoPushedAt: string | null;
};

export type GithubEventInput = {
  githubEventId: string;
  eventType: string;
  repoFullName: string;
  repoGithubId: number | null;
  actorLogin: string | null;
  actorAvatarUrl: string | null;
  summary: string;
  ref: string | null;
  htmlUrl: string | null;
  /** Head commit message for PushEvents (first line), null otherwise. */
  headCommitMessage: string | null;
  eventCreatedAt: string;
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function asInt(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : 0;
}
function asIso(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** Map one /orgs/:org/repos array entry to our input shape. */
export function parseRepo(raw: Record<string, unknown>): GithubRepoInput {
  const name = asString(raw.name) ?? "";
  const ownerObj = (raw.owner ?? {}) as Record<string, unknown>;
  const licenseObj = (raw.license ?? null) as Record<string, unknown> | null;
  return {
    githubRepoId: asInt(raw.id),
    name,
    fullName: asString(raw.full_name) ?? `${GITHUB_ORG}/${name}`,
    owner: asString(ownerObj.login) ?? GITHUB_ORG,
    description: asString(raw.description),
    htmlUrl: asString(raw.html_url) ?? `${GITHUB_ORG_URL}/${name}`,
    homepage: asString(raw.homepage),
    stargazersCount: asInt(raw.stargazers_count),
    forksCount: asInt(raw.forks_count),
    openIssuesCount: asInt(raw.open_issues_count),
    watchersCount: asInt(raw.watchers_count),
    language: asString(raw.language),
    topics: Array.isArray(raw.topics) ? (raw.topics as unknown[]).filter((t): t is string => typeof t === "string") : [],
    licenseSpdx: licenseObj ? asString(licenseObj.spdx_id) : null,
    isArchived: raw.archived === true,
    isFork: raw.fork === true,
    isTemplate: raw.is_template === true,
    defaultBranch: asString(raw.default_branch),
    sizeKb: typeof raw.size === "number" ? Math.trunc(raw.size) : null,
    isNotable: isNotable(name),
    repoCreatedAt: asIso(raw.created_at),
    repoUpdatedAt: asIso(raw.updated_at),
    repoPushedAt: asIso(raw.pushed_at)
  };
}

/** Human one-liner for an org event, by type. */
export function summarizeEvent(raw: Record<string, unknown>): string {
  const type = asString(raw.type) ?? "Event";
  const payload = (raw.payload ?? {}) as Record<string, unknown>;
  const ref = asString(payload.ref);
  const branch = ref ? ref.replace(/^refs\/heads\//, "").replace(/^refs\/tags\//, "") : null;
  switch (type) {
    case "ReleaseEvent": {
      const release = (payload.release ?? {}) as Record<string, unknown>;
      const tag = asString(release.tag_name) ?? asString(release.name) ?? "a release";
      return `Released ${tag}`;
    }
    case "PushEvent": {
      const commits = Array.isArray(payload.commits) ? payload.commits.length : asInt(payload.size);
      const n = commits || 1;
      return `Pushed ${n} commit${n === 1 ? "" : "s"}${branch ? ` to ${branch}` : ""}`;
    }
    case "CreateEvent": {
      const refType = asString(payload.ref_type) ?? "ref";
      return refType === "repository" ? "Created repository" : `Created ${refType} ${branch ?? ""}`.trim();
    }
    case "DeleteEvent": {
      const refType = asString(payload.ref_type) ?? "ref";
      return `Deleted ${refType} ${branch ?? ""}`.trim();
    }
    case "PullRequestEvent": {
      const action = asString(payload.action) ?? "updated";
      const pr = (payload.pull_request ?? {}) as Record<string, unknown>;
      const num = asInt(payload.number) || asInt(pr.number);
      const merged = pr.merged === true;
      const verb = action === "closed" && merged ? "Merged" : action.charAt(0).toUpperCase() + action.slice(1);
      return `${verb} PR #${num}`.trim();
    }
    case "IssuesEvent": {
      const action = asString(payload.action) ?? "updated";
      const issue = (payload.issue ?? {}) as Record<string, unknown>;
      const num = asInt(issue.number);
      return `${action.charAt(0).toUpperCase() + action.slice(1)} issue #${num}`.trim();
    }
    case "IssueCommentEvent": {
      const issue = (payload.issue ?? {}) as Record<string, unknown>;
      const num = asInt(issue.number);
      return num ? `Commented on #${num}` : "Commented";
    }
    case "PublicEvent":
      return "Open-sourced the repository";
    case "MemberEvent":
      return "Updated collaborators";
    case "ForkEvent":
      return "Forked the repository";
    default:
      // Humanize "SomethingEvent" -> "Something".
      return type.replace(/Event$/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
  }
}

/** Map one /orgs/:org/events array entry to our input shape, or null for
 *  noise we don't surface (stars). */
export function parseEvent(raw: Record<string, unknown>): GithubEventInput | null {
  const type = asString(raw.type);
  const id = asString(raw.id);
  if (!type || !id) return null;
  if (type === "WatchEvent") return null; // star spam, not an "update"

  const repo = (raw.repo ?? {}) as Record<string, unknown>;
  const actor = (raw.actor ?? {}) as Record<string, unknown>;
  const payload = (raw.payload ?? {}) as Record<string, unknown>;
  const repoFullName = asString(repo.name) ?? GITHUB_ORG;
  const ref = asString(payload.ref);

  let htmlUrl: string | null = `https://github.com/${repoFullName}`;
  // `tag` carries the release version (ReleaseEvents have no payload.ref);
  // `commitMessage` carries the head commit's first line (PushEvents).
  let tag: string | null = null;
  let commitMessage: string | null = null;
  if (type === "ReleaseEvent") {
    const release = (payload.release ?? {}) as Record<string, unknown>;
    htmlUrl = asString(release.html_url) ?? htmlUrl;
    tag = asString(release.tag_name) ?? asString(release.name);
  } else if (type === "PullRequestEvent") {
    const pr = (payload.pull_request ?? {}) as Record<string, unknown>;
    htmlUrl = asString(pr.html_url) ?? htmlUrl;
  } else if (type === "PushEvent") {
    const commits = Array.isArray(payload.commits) ? (payload.commits as Array<Record<string, unknown>>) : [];
    const head = commits.length > 0 ? commits[commits.length - 1] : null;
    const msg = head ? asString(head.message) : null;
    commitMessage = msg ? msg.split("\n")[0].trim().slice(0, 200) : null;
  }

  return {
    githubEventId: id,
    eventType: type,
    repoFullName,
    repoGithubId: typeof repo.id === "number" ? Math.trunc(repo.id) : null,
    actorLogin: asString(actor.login),
    actorAvatarUrl: asString(actor.avatar_url),
    summary: summarizeEvent(raw),
    ref: tag ?? (ref ? ref.replace(/^refs\/(heads|tags)\//, "") : null),
    htmlUrl,
    headCommitMessage: commitMessage,
    eventCreatedAt: asIso(raw.created_at) ?? new Date().toISOString()
  };
}

function githubHeaders(token: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": USER_AGENT
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

export type GithubRateInfo = { remaining: number | null; limit: number | null };

/** Paginated GET against the GitHub API. Stops at maxPages or the first
 *  short page. Throws on a non-2xx (the caller decides whether to abort a
 *  section or fail the whole run). */
export async function githubGetAll(
  path: string,
  opts: { token?: string; maxPages?: number; perPage?: number } = {}
): Promise<{ items: Array<Record<string, unknown>>; rate: GithubRateInfo }> {
  const maxPages = opts.maxPages ?? 3;
  const perPage = opts.perPage ?? 100;
  const headers = githubHeaders(opts.token);
  const items: Array<Record<string, unknown>> = [];
  let rate: GithubRateInfo = { remaining: null, limit: null };

  for (let page = 1; page <= maxPages; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${GITHUB_API}${path}${sep}per_page=${perPage}&page=${page}`;
    const res = await fetch(url, { headers });
    rate = {
      remaining: numHeader(res.headers.get("x-ratelimit-remaining")),
      limit: numHeader(res.headers.get("x-ratelimit-limit"))
    };
    if (res.status === 403 && rate.remaining === 0) {
      throw new Error(`GitHub rate limit exhausted fetching ${path} (set GITHUB_TOKEN to raise it)`);
    }
    if (!res.ok) {
      throw new Error(`GitHub HTTP ${res.status} fetching ${path}`);
    }
    const body = (await res.json()) as unknown;
    const pageItems = Array.isArray(body) ? (body as Array<Record<string, unknown>>) : [];
    items.push(...pageItems);
    if (pageItems.length < perPage) break;
  }
  return { items, rate };
}

function numHeader(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export type GithubLatestCommit = {
  message: string;
  committedAt: string | null;
  url: string;
};

/** Latest commit on a repo's default branch. The org events feed doesn't
 *  carry commit messages, so this is the reliable source. Returns null on
 *  any error (empty repo / 404 / transient) so one repo can't abort the
 *  run. Rate-limit 403 is rethrown so the caller can stop the loop. */
export async function fetchLatestCommit(
  fullName: string,
  token: string | undefined
): Promise<GithubLatestCommit | null> {
  const url = `${GITHUB_API}/repos/${fullName}/commits?per_page=1`;
  const res = await fetch(url, { headers: githubHeaders(token) });
  if (res.status === 403 && numHeader(res.headers.get("x-ratelimit-remaining")) === 0) {
    throw new Error("GitHub rate limit exhausted fetching commits (set GITHUB_TOKEN to raise it)");
  }
  if (!res.ok) return null; // 409 empty repo, 404, etc.
  const body = (await res.json()) as unknown;
  if (!Array.isArray(body) || body.length === 0) return null;
  const top = body[0] as Record<string, unknown>;
  const commit = (top.commit ?? {}) as Record<string, unknown>;
  const author = (commit.author ?? {}) as Record<string, unknown>;
  const raw = asString(commit.message);
  if (!raw) return null;
  return {
    message: raw.split("\n")[0].trim().slice(0, 200),
    committedAt: asIso(author.date),
    url: asString(top.html_url) ?? `https://github.com/${fullName}`
  };
}
