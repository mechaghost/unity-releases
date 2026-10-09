import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fetchText: vi.fn() }));
vi.mock("../../src/lib/ingest/fetch", () => ({ fetchText: mocks.fetchText }));
import { fetchTargetRelease } from "../../src/jobs/backfill-unity6";

const release = { version: "6000.3.26f1", stream: "LTS", releaseDate: "2026-10-08T00:00:00Z",
  shortRevision: "de8167e7440c", releaseNotes: { url: "https://example.com/notes.md" },
  downloads: [{ url: "https://example.com/editor.exe", modules: [{ url: "https://example.com/module.exe" }] }] };
beforeEach(() => mocks.fetchText.mockReset());
function response(results: unknown[], status = 200) {
  return { status, text: JSON.stringify({ results }), finalUrl: "https://example.com/api" };
}
test("target lookup makes exactly one request for the exact version", async () => {
  mocks.fetchText.mockResolvedValue(response([{ ...release, version: "6000.3.25f1" }, release]));
  expect(await fetchTargetRelease(release.version)).toEqual(release);
  expect(mocks.fetchText).toHaveBeenCalledExactlyOnceWith(
    "https://services.api.unity.com/unity/editor/release/v1/releases?version=6000.3.26f1");
});
test("does not accept a neighbouring version or incomplete API record", async () => {
  mocks.fetchText.mockResolvedValue(response([{ ...release, version: "6000.3.25f1" }]));
  await expect(fetchTargetRelease(release.version)).rejects.toThrow("No exact API release");
  mocks.fetchText.mockResolvedValue(response([{ ...release, downloads: [] }]));
  await expect(fetchTargetRelease(release.version)).rejects.toThrow("Incomplete release metadata");
});
test("rejects failed responses and unsupported versions", async () => {
  mocks.fetchText.mockResolvedValue(response([release], 404));
  await expect(fetchTargetRelease(release.version)).rejects.toThrow("HTTP 404");
  mocks.fetchText.mockClear();
  await expect(fetchTargetRelease("2022.3.1f1")).rejects.toThrow("Not a modern Unity release");
  expect(mocks.fetchText).not.toHaveBeenCalled();
});
