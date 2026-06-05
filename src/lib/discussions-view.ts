/**
 * Pure view helpers for the /discussions page. Kept out of the React
 * component so the URL/sort/avatar logic can be unit-tested without
 * rendering a server component or touching the database.
 */

export const DISCOURSE_BASE = "https://discussions.unity.com";

export type DiscourseSort = "recent" | "newest" | "popular" | "edited";

const VALID_SORTS: ReadonlySet<string> = new Set([
  "recent",
  "newest",
  "popular",
  "edited"
]);

/** Coerce an arbitrary `sort` query param to a known sort, defaulting to
 *  "recent" (most-recently-updated, the page's default ordering). */
export function normalizeSort(value: string | undefined): DiscourseSort {
  return value && VALID_SORTS.has(value) ? (value as DiscourseSort) : "recent";
}

export type DiscussionsHrefState = {
  q?: string;
  category?: string;
  author?: string;
  sort?: string;
  edited?: boolean;
  page?: number;
};

/** Build a /discussions URL from filter state, omitting defaults so the
 *  canonical (unfiltered) page stays a bare `/discussions`. `sort=recent`
 *  and `page=1` are defaults and therefore never serialized. */
export function buildDiscussionsHref(state: DiscussionsHrefState): string {
  const sp = new URLSearchParams();
  if (state.q) sp.set("q", state.q);
  if (state.category) sp.set("category", state.category);
  if (state.author) sp.set("author", state.author);
  if (state.sort && state.sort !== "recent") sp.set("sort", state.sort);
  if (state.edited) sp.set("edited", "1");
  if (state.page && state.page > 1) sp.set("page", String(state.page));
  const qs = sp.toString();
  return qs ? `/discussions?${qs}` : "/discussions";
}

/** Discourse `avatar_template` is a path with a `{size}` placeholder
 *  (e.g. `/user_avatar/host/name/{size}/123.png`). Resolve it to an
 *  absolute URL at a small render size, or null when absent/unusable.
 *
 *  The template is upstream data (the Discourse API), so we never render
 *  an arbitrary absolute `src`: a poisoned template pointing at an
 *  attacker host would otherwise leak every viewer's IP / act as a
 *  tracking pixel. Relative paths resolve against discussions.unity.com;
 *  absolute URLs are only honored over https and only for Unity or the
 *  standard Discourse avatar CDN. Anything else resolves to null (no
 *  avatar), which the card already degrades to gracefully. */
export function avatarUrl(
  template: string | null | undefined,
  size = 48
): string | null {
  if (!template) return null;
  const sized = template.replace("{size}", String(size));
  if (sized.startsWith("/")) return `${DISCOURSE_BASE}${sized}`;
  let url: URL;
  try {
    url = new URL(sized);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  const allowed =
    host === "unity.com" ||
    host.endsWith(".unity.com") ||
    host.endsWith(".discourse-cdn.com");
  return allowed ? url.toString() : null;
}
