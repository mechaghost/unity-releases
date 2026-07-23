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
import {
  apiStreamToUnityStream,
  parseUnityVersion,
  type UnityStream
} from "../parsers/version";

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
    const apiStream =
      typeof hit?.stream === "string" && hit.stream.length > 0 ? hit.stream : null;
    // A non-empty but unknown value is not authoritative. Treat it exactly like
    // a failed lookup so callers can retain a known-good stored classification.
    return apiStreamToUnityStream(apiStream) ? apiStream : null;
  } catch {
    return null;
  }
}

export type ResolvedStream = {
  stream: UnityStream;
  /** "api" = Unity's own label, "retained" = kept the stored value, "parsed" = version-derived. */
  source: "api" | "retained" | "parsed";
};

/**
 * Decide the stream to store for a scraped editor release, given Unity's API
 * answer (or null on failure) and whatever is already stored for this version.
 *
 * When the API lookup fails, a *final* build's fallback is only a guess from the
 * curated LTS map - and for a line the map doesn't know (a new generation's
 * first LTS line, e.g. 7000.0) that guess is "Update/Supported", not LTS.
 * Because the upsert does `ON CONFLICT ... SET stream = EXCLUDED.stream`, writing
 * that guess would overwrite a previously-correct, API-sourced stream on any
 * flaky nightly run - and it's sticky (backfill skips already-stored versions).
 * So on API failure we KEEP the stored value for a final build rather than
 * downgrade it. Alpha/beta/patch are channel-derived and always correct, so they
 * always take the parsed value.
 */
export function resolveIngestStream(opts: {
  version: string;
  apiStream: string | null;
  storedStream: string | null;
}): ResolvedStream {
  if (apiStreamToUnityStream(opts.apiStream)) {
    return {
      stream: parseUnityVersion(opts.version, { apiStream: opts.apiStream }).stream,
      source: "api"
    };
  }
  const parsed = parseUnityVersion(opts.version).stream;
  const isFinalBuild = parsed === "LTS" || parsed === "Update/Supported";
  if (isFinalBuild && opts.storedStream && opts.storedStream !== parsed) {
    return { stream: opts.storedStream as UnityStream, source: "retained" };
  }
  return { stream: parsed, source: "parsed" };
}

/**
 * Whether a backfill row is fully current, including its API-authoritative
 * stream classification.
 *
 * Parser-version equality alone is insufficient: poll-editor may have first
 * seen a brand-new LTS final while the single-version API lookup was down and
 * stored the offline map's Supported guess. The later backfill already has the
 * release API's stream, so a mismatch must force one normal re-ingest to repair
 * the release row and its denormalized release-note rows.
 */
export function storedReleaseCanBeSkipped(opts: {
  version: string;
  apiStream: string | null;
  storedStream: string | null;
  storedParserVersion: string | null;
  currentParserVersion: string;
}): boolean {
  if (opts.storedParserVersion !== opts.currentParserVersion) return false;

  if (!apiStreamToUnityStream(opts.apiStream)) {
    // The API cannot improve this row right now. Keep the current-parser data
    // instead of replaying it with another fallback guess.
    return true;
  }

  const authoritative = parseUnityVersion(opts.version, {
    apiStream: opts.apiStream
  }).stream;
  return opts.storedStream === authoritative;
}
