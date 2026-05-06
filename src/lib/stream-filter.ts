import { cookies } from "next/headers";

export const STREAM_FILTER_COOKIE = "unity-alerts-streams";

export const ALL_STREAMS = ["LTS", "Update/Supported", "beta", "alpha"] as const;
export type StreamName = (typeof ALL_STREAMS)[number];

/** Default when no cookie is set: stable streams only. */
export const DEFAULT_STREAMS: StreamName[] = ["LTS", "Update/Supported"];

/**
 * Parse a raw cookie value into a list of allowed streams. Pure and
 * testable; the async `getStreamFilter` wraps this with `next/headers`.
 *
 * - `undefined`  → first visit, no cookie → fall back to the default.
 * - empty / whitespace → user explicitly unchecked everything.
 * - csv list   → trim, drop unknown values.
 */
export function parseStreamFilterCookie(raw: string | undefined): StreamName[] {
  if (raw === undefined) return DEFAULT_STREAMS;
  if (raw.trim() === "") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is StreamName => (ALL_STREAMS as readonly string[]).includes(s));
}

/**
 * The user-controlled stream filter that hides prerelease noise from
 * release lists by default. An empty cookie value means "user unchecked
 * everything" — return an empty array, not the default.
 */
export async function getStreamFilter(): Promise<StreamName[]> {
  const jar = await cookies();
  return parseStreamFilterCookie(jar.get(STREAM_FILTER_COOKIE)?.value);
}

/** True when the given release stream is allowed by the current filter. */
export function streamMatches(stream: string | null, allowed: StreamName[]): boolean {
  if (!stream) return false;
  return (allowed as string[]).includes(stream);
}
