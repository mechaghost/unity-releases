/**
 * Pure view helpers for the /github page — URL state, compact number
 * formatting, and event-type labelling. Unit-tested without rendering.
 */

export const GITHUB_ORG_URL = "https://github.com/Unity-Technologies";

export type GithubSort = "stars" | "newest" | "updated" | "forks";
const VALID_SORTS: ReadonlySet<string> = new Set(["stars", "newest", "updated", "forks"]);

/** Default sort is "updated" — the page is built around "which Unity repo
 *  is most recently active." */
export const DEFAULT_GITHUB_SORT: GithubSort = "updated";

export function normalizeGithubSort(value: string | undefined): GithubSort {
  return value && VALID_SORTS.has(value) ? (value as GithubSort) : DEFAULT_GITHUB_SORT;
}

/** The sort control on /github. Recently updated leads (it's the default). */
export const GITHUB_TABS: ReadonlyArray<{ key: string; label: string; sort: GithubSort }> = [
  { key: "updated", label: "Recently updated", sort: "updated" },
  { key: "stars", label: "Stars", sort: "stars" },
  { key: "newest", label: "Newest", sort: "newest" },
  { key: "forks", label: "Most forks", sort: "forks" }
];

export type GithubHrefState = {
  q?: string;
  language?: string;
  topic?: string;
  sort?: string;
  notable?: boolean;
  /** include archived repos (hidden by default) */
  archived?: boolean;
  /** include forks (hidden by default) */
  forks?: boolean;
  page?: number;
};

/** Build a /github URL from filter state, omitting defaults so the
 *  canonical page stays a bare /github. sort=updated (the default) and
 *  page=1 are not serialized. */
export function buildGithubHref(state: GithubHrefState): string {
  const sp = new URLSearchParams();
  if (state.q) sp.set("q", state.q);
  if (state.language) sp.set("lang", state.language);
  if (state.topic) sp.set("topic", state.topic);
  if (state.sort && state.sort !== DEFAULT_GITHUB_SORT) sp.set("sort", state.sort);
  if (state.notable) sp.set("notable", "1");
  if (state.archived) sp.set("archived", "1");
  if (state.forks) sp.set("forks", "1");
  if (state.page && state.page > 1) sp.set("page", String(state.page));
  const qs = sp.toString();
  return qs ? `/github?${qs}` : "/github";
}

/** Compact star/fork counts: 1234 -> "1.2k", 12000 -> "12k". */
export function formatCompact(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n < 1000) return String(Math.trunc(n));
  if (n < 10000) return (Math.round(n / 100) / 10).toFixed(1).replace(/\.0$/, "") + "k";
  if (n < 1_000_000) return Math.round(n / 1000) + "k";
  return (Math.round(n / 100_000) / 10).toFixed(1).replace(/\.0$/, "") + "m";
}

/** Short badge label for an activity event type. */
export function eventTypeLabel(type: string): string {
  switch (type) {
    case "ReleaseEvent":
      return "Release";
    case "PushEvent":
      return "Push";
    case "CreateEvent":
      return "New";
    case "DeleteEvent":
      return "Delete";
    case "PullRequestEvent":
      return "PR";
    case "IssuesEvent":
      return "Issue";
    case "IssueCommentEvent":
      return "Comment";
    case "PublicEvent":
      return "Open-sourced";
    case "ForkEvent":
      return "Fork";
    case "MemberEvent":
      return "Members";
    default:
      return type.replace(/Event$/, "");
  }
}
