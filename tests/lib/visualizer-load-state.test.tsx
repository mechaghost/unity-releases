import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const aggregates = vi.hoisted(() => vi.fn());
vi.mock("@/lib/visualizer", () => ({
  DOMAINS: ["Rendering"],
  getVersionAggregates: aggregates,
  getVersionFacts: async () => [],
  getIssueLifespans: async () => [],
  getPatchCadence: async () => [],
  getScoreInputs: async () => [],
  getAreaHeatmap: async () => [],
  getPackageEditorMatrix: async () => ({ rows: [], packages: [] })
}));
vi.mock("@/lib/db/repositories", () => ({ listIngestionFreshness: async () => [] }));
vi.mock("@/app/visualizer/_components/DomainFilterChips", () => ({ DomainFilterChips: () => null }));
import VisualizerPage from "@/app/visualizer/page";
it("reports partial failures separately from genuine empty charts", async () => {
  aggregates.mockRejectedValueOnce(new Error("offline"));
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  const failed = renderToStaticMarkup(await VisualizerPage({ searchParams: Promise.resolve({}) }));
  expect(failed).toContain("Some charts could not load");
  aggregates.mockResolvedValueOnce([]);
  const empty = renderToStaticMarkup(await VisualizerPage({ searchParams: Promise.resolve({}) }));
  expect(empty).not.toContain("Some charts could not load");
  expect(empty).toContain("Other charts show all domains");
  logged.mockRestore();
});
