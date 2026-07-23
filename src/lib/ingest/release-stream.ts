/**
 * Look up Unity's authoritative `stream` for a single editor version.
 *
 * The release *pages* we scrape carry their own `stream` field, but it uses
 * a different vocabulary and doesn't agree with Unity's release catalogue
 * (6000.3.14f1 - an LTS build - is tagged "TECH" in the page payload). The
 * release API is the source that matches what Unity publishes, so the
 * scrape path asks it directly rather than trusting the embedded value.
 *
 * Best-effort by design: every failure returns null and the caller falls
 * back to classifying by version channel. A flaky API must never block an
 * ingest run.
 */

import { fetchText } from "./fetch";

export const RELEASE_API_BASE = "https://services.api.unity.com/unity/editor/release/v1/releases";

type VersionLookupResponse = {
  results?: Array<{ version?: unknown; stream?: unknown }>;
};

/** Unity's `stream` for `version` ("LTS" | "SUPPORTED" | "BETA" | "ALPHA"), or null. */
export async function fetchApiStream(version: string): Promise<string | null> {
  try {
    const url = `${RELEASE_API_BASE}?version=${encodeURIComponent(version)}`;
    const fetched = await fetchText(url);
    if (fetched.status !== 200) {
      return null;
    }
    const body = JSON.parse(fetched.text) as VersionLookupResponse;
    // The filter is exact, but match on version anyway so a future fuzzy
    // match can't hand us a neighbouring release's stream.
    const hit = body.results?.find((r) => r.version === version);
    return typeof hit?.stream === "string" && hit.stream.length > 0 ? hit.stream : null;
  } catch {
    return null;
  }
}
