import { describe, expect, test, vi } from "vitest";
import { assertReleaseSourceOk } from "../../src/lib/ingest/release-integrity";
import { extractReleasePageMetadata } from "../../src/lib/parsers/release-page";
import { extractApiReleaseMetadata } from "../../src/lib/parsers/release-api";
import { normalizeReleaseForStorage } from "../../src/lib/ingest/releases";
import { upsertReleaseBundle } from "../../src/lib/db/repositories";
import { storedReleaseCanBeSkipped } from "../../src/lib/ingest/release-stream";
import type { PoolClient } from "pg";

const metadata = extractApiReleaseMetadata({
  version: "6000.3.26f1", stream: "LTS", releaseDate: "2026-10-08T00:00:00Z",
  shortRevision: "de8167e7440c", releaseNotes: { url: "https://example.com/notes.md" },
  downloads: [{ platform: "WINDOWS", architecture: "X86_64", url: "https://example.com/editor.exe",
    modules: [{ name: "Android", category: "PLATFORM", url: "https://example.com/android.exe" }] }]
});
const bundle = () => normalizeReleaseForStorage({ metadata,
  releaseNotesMarkdown: "### 6000.3.26f1 Release Notes\n\n#### Fixes\n\n- Editor: Fixed crash.",
  sourceSnapshotId: 1, ingestionRunId: 1, parserVersion: "current" });

describe("release ingestion integrity", () => {
  test("rejects non-200 and empty source bodies", () => {
    const source = { url: "https://example.com", finalUrl: "https://example.com", status: 403,
      text: "Access denied", etag: null, lastModified: null, sha256: "hash" };
    expect(() => assertReleaseSourceOk(source)).toThrow("HTTP 403");
    expect(() => assertReleaseSourceOk({ ...source, status: 200, text: " " })).toThrow("empty body");
  });

  test("URL-only release pages cannot cause any database writes", async () => {
    const bad = normalizeReleaseForStorage({
      metadata: extractReleasePageMetadata("<html>Access denied</html>", metadata.releasePageUrl),
      releaseNotesMarkdown: "Access denied", sourceSnapshotId: 2, ingestionRunId: 2, parserVersion: "current"
    });
    const query = vi.fn();
    await expect(upsertReleaseBundle({ query } as unknown as PoolClient, bad)).rejects.toThrow("Incomplete release metadata");
    expect(query).not.toHaveBeenCalled();
  });

  test.each(["artifacts", "modules", "noteItems"] as const)("rejects empty %s before replacement", async (field) => {
    const bad = bundle();
    bad[field] = [];
    if (field !== "noteItems") bad.release.rawMetadataJson = { ...metadata, [field]: [] };
    const query = vi.fn();
    await expect(upsertReleaseBundle({ query } as unknown as PoolClient, bad)).rejects.toThrow(/Incomplete|Empty/);
    expect(query).not.toHaveBeenCalled();
  });

  test("valid bundles still enter the upsert", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 1 }] });
    await upsertReleaseBundle({ query } as unknown as PoolClient, bundle());
    expect(query.mock.calls[0][0]).toContain("INSERT INTO unity_releases");
  });

  test("an incomplete current-parser row is repaired even with a matching stream", () => {
    expect(storedReleaseCanBeSkipped({ version: metadata.version, apiStream: "LTS", storedStream: "LTS",
      storedParserVersion: "current", currentParserVersion: "current", storedComplete: false })).toBe(false);
  });
});
