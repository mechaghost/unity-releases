import { expect, test, vi } from "vitest";
const state = vi.hoisted(() => ({ inTransaction: false, writes: 0 }));
vi.mock("../../src/lib/ingest/fetch", () => ({ fetchText: vi.fn(async () => ({ status: 200, text: '<url><loc>https://unity.com/releases/editor/whats-new/2022.3.1f1</loc></url>' })) }));
vi.mock("../../src/lib/ingest/runner", () => ({
  fetchHtmlWithRetry: vi.fn(async () => { expect(state.inTransaction).toBe(false); return { text: "notes", finalUrl: "https://unity.com/page", status: 200 }; }),
  runWithConcurrency: async (rows: unknown[], _n: number, work: (row: unknown) => Promise<void>) => { for (const row of rows) await work(row); }
}));
vi.mock("../../src/lib/parsers/release-page", () => ({ extractReleasePageMetadata: () => ({ version: "2022.3.1f1", releaseNotesUrl: "https://unity.com/notes" }) }));
vi.mock("../../src/lib/ingest/releases", () => ({ normalizeReleaseForStorage: (input: unknown) => input }));
vi.mock("../../src/lib/db/repositories", () => ({
  withIngestionTransaction: async (_s: string, _j: string, work: (client: object, runId: number) => Promise<void>) => {
    expect(state.inTransaction).toBe(false); state.inTransaction = true;
    try { await work({}, 1); } finally { state.inTransaction = false; }
  },
  recordSourceSnapshot: async () => 1,
  upsertReleaseBundle: async () => { expect(state.inTransaction).toBe(true); state.writes++; }
}));
import { main } from "../../src/jobs/poll-legacy-lts";
test("legacy imports finish network requests before each release write transaction", async () => {
  await main(); expect(state.writes).toBe(4); expect(state.inTransaction).toBe(false);
});
