/**
 * Contract test against Unity's live release API.
 *
 * Stream classification for final builds is delegated to the API's `stream`
 * field - that's what lets a new LTS line (6000.7, or Unity 7's first) be
 * classified with no code change. The failure mode is silent: if Unity drops
 * or renames the field, every release quietly falls back to the curated map
 * and new lines get mislabeled `Update/Supported` with nothing to notice it.
 *
 * So this asserts the contract directly. It is opt-in - the suite must stay
 * green offline and in CI without network:
 *
 *   UNITY_API_CONTRACT=1 npx vitest run tests/ingest/unity-api-contract.test.ts
 */

import { describe, expect, test } from "vitest";
import { RELEASE_API_BASE } from "../../src/lib/ingest/release-stream";
import { apiStreamToUnityStream, parseUnityVersion } from "../../src/lib/parsers/version";
import { isModernMajor } from "../../src/lib/unity-generation";

const ENABLED = process.env.UNITY_API_CONTRACT === "1";
const TIMEOUT_MS = 30_000;

type ApiRelease = { version?: unknown; stream?: unknown };

async function fetchStream(stream: string): Promise<ApiRelease[]> {
  const res = await fetch(`${RELEASE_API_BASE}?limit=25&stream=${stream}`, {
    headers: { accept: "application/json" }
  });
  expect(res.ok, `Unity API ${stream} -> HTTP ${res.status}`).toBe(true);
  const body = (await res.json()) as { results?: ApiRelease[] };
  return body.results ?? [];
}

describe.skipIf(!ENABLED)("Unity release API contract", () => {
  test(
    "every release carries a stream we understand",
    async () => {
      const results = await fetchStream("LTS");
      expect(results.length).toBeGreaterThan(0);

      for (const release of results) {
        expect(typeof release.stream, `missing stream on ${String(release.version)}`).toBe(
          "string"
        );
        expect(
          apiStreamToUnityStream(release.stream as string),
          `unmapped stream "${String(release.stream)}"`
        ).not.toBeNull();
      }
    },
    TIMEOUT_MS
  );

  test(
    "the LTS stream agrees with how we'd classify its final builds",
    async () => {
      const results = await fetchStream("LTS");
      const finals = results.filter((r) => {
        try {
          const parsed = parseUnityVersion(String(r.version));
          return parsed.suffixChannel === "f" && isModernMajor(parsed.major);
        } catch {
          return false;
        }
      });
      expect(finals.length).toBeGreaterThan(0);

      for (const release of finals) {
        expect(
          parseUnityVersion(String(release.version), { apiStream: release.stream as string })
            .stream,
          `${String(release.version)} should resolve to LTS`
        ).toBe("LTS");
      }
    },
    TIMEOUT_MS
  );

  test(
    "the single-version lookup the scrape path relies on still filters exactly",
    async () => {
      const [newest] = await fetchStream("LTS");
      const version = String(newest.version);

      const res = await fetch(`${RELEASE_API_BASE}?version=${encodeURIComponent(version)}`, {
        headers: { accept: "application/json" }
      });
      expect(res.ok).toBe(true);
      const body = (await res.json()) as { results?: ApiRelease[] };
      expect(body.results?.some((r) => r.version === version)).toBe(true);
    },
    TIMEOUT_MS
  );
});
