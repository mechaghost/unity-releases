import {
  DOMAINS,
  getAreaHeatmap,
  getIssueLifespans,
  getPackageEditorMatrix,
  getPatchCadence,
  getScoreInputs,
  getVersionAggregates,
  getVersionFacts,
  type AreaHeatmapCell,
  type Domain,
  type IssueLifespan,
  type PackageMatrixRow,
  type PatchCadencePoint,
  type VersionAggregate,
  type VersionFact
} from "@/lib/visualizer";
import { listIngestionFreshness, type IngestionFreshness } from "@/lib/db/repositories";
import { scoreAllReleases, type ScoreInput } from "@/lib/score";
import { pageSocialMetadata } from "@/lib/site";
import { AreaHeatmap } from "./_components/AreaHeatmap";
import { BuildScoreLeaderboard } from "./_components/BuildScoreLeaderboard";
import { DecayCurve } from "./_components/DecayCurve";
import { DomainFilterChips } from "./_components/DomainFilterChips";
import { IssueLifespanLines } from "./_components/IssueLifespanLines";
import { PackageEditorMatrix } from "./_components/PackageEditorMatrix";
import { PatchCadenceDots } from "./_components/PatchCadenceDots";
import { StabilityHeatStrip } from "./_components/StabilityHeatStrip";
import { Top10FactsPanel } from "./_components/Top10FactsPanel";
import { TrustRail } from "./_components/TrustRail";

// Keep ISR for /visualizer — the data only refreshes on the 2×/day cron,
// so 5-minute staleness is invisible to users and saves a full re-render
// of the heaviest page on the site. `force-dynamic` was silently
// overriding `revalidate`; both are kept only via the absence of dynamic.
export const revalidate = 300;

const PAGE_DESCRIPTION =
  "Visual at-a-glance read on Unity 6+ release health: stability per release, breaking-change concentration by subsystem, longest-living open issues, package compatibility over time, and a Top-10 dynamic facts panel computed from the underlying release-note corpus.";

export const metadata = {
  title: "Release Visualizer",
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/visualizer" },
  ...pageSocialMetadata({ title: "Release Visualizer", description: PAGE_DESCRIPTION, path: "/visualizer" })
};

function parseDomain(value: string | string[] | undefined): Domain | "Other" | null {
  if (typeof value !== "string") return null;
  if (value === "Other") return "Other";
  return (DOMAINS as readonly string[]).includes(value) ? (value as Domain) : null;
}

export default async function VisualizerPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const domain = parseDomain(params.domain);

  // Every DB call below is wrapped in a `safeX` helper that swallows
  // errors and returns an empty default. A single dead query no longer
  // 500s the whole page — each chart card has its own "no data yet"
  // empty state, so the page degrades gracefully if (e.g.) the
  // `issue_mentions` index isn't built yet on a fresh deploy.
  const [versions, facts, freshness, lifespans, cadence, scoreInputs] = await Promise.all([
    safeVersionAggregates(domain),
    safeVersionFacts(domain),
    safeFreshness(),
    safeIssueLifespans(domain),
    safePatchCadence(),
    safeScoreInputs()
  ]);
  const { results: scoreResults } = scoreAllReleases(scoreInputs);
  // Enrich each leaderboard row with the release's metadata (stream +
  // date) so the panel can show what version each badge belongs to
  // without forcing the user to hover.
  const leaderboardRows = [...scoreResults.values()].map((result) => {
    const meta = scoreInputs.find((s) => s.version === result.version);
    return {
      result,
      stream: meta?.stream ?? null,
      releaseDate: meta?.releaseDate ?? null
    };
  });

  // Need versions resolved before we can fetch heatmap + matrix that
  // reference the same version set.
  const visibleVersionIds = versions.slice(0, 60).map((v) => v.version);
  const [heatmapCells, matrix] = await Promise.all([
    safeHeatmap(visibleVersionIds),
    safeMatrix()
  ]);

  return (
    <>
      <section className="page-header">
        <div className="page-header__title-row">
          <h1>Release Visualizer</h1>
        </div>
        <p>
          A visual read on what each Unity 6+ release actually shipped —
          stability per patch, where breaking changes landed, which bugs
          are still open, and how packages drift alongside the editor.
          Every number on this page is a raw count from the underlying
          release notes; formulas are visible inline.
        </p>
      </section>

      <DomainFilterChips activeDomain={domain} />

      <div className="viz-grid">
        <div className="viz-main">
          <StabilityHeatStrip versions={versions} />
          <BuildScoreLeaderboard rows={leaderboardRows} />
          <DecayCurve versions={versions} />
          <AreaHeatmap cells={heatmapCells} versions={versions} />
          <IssueLifespanLines issues={lifespans} />
          <PackageEditorMatrix rows={matrix.rows} packages={matrix.packages} />
          <PatchCadenceDots points={cadence} />
        </div>
        <div className="viz-side">
          <Top10FactsPanel facts={facts} />
        </div>
      </div>

      <TrustRail freshness={freshness} />
    </>
  );
}

async function safeVersionAggregates(domain: Domain | "Other" | null): Promise<VersionAggregate[]> {
  try {
    return await getVersionAggregates({ domain: domain ?? undefined, limit: 120 });
  } catch (err) {
    console.error("[visualizer] getVersionAggregates failed:", err);
    return [];
  }
}

async function safeVersionFacts(domain: Domain | "Other" | null): Promise<VersionFact[]> {
  try {
    return await getVersionFacts({ domain: domain ?? undefined });
  } catch (err) {
    console.error("[visualizer] getVersionFacts failed:", err);
    return [];
  }
}

async function safeFreshness(): Promise<IngestionFreshness[]> {
  try {
    return await listIngestionFreshness();
  } catch (err) {
    console.error("[visualizer] listIngestionFreshness failed:", err);
    return [];
  }
}

async function safeIssueLifespans(domain: Domain | "Other" | null): Promise<IssueLifespan[]> {
  try {
    return await getIssueLifespans({ domain: domain ?? undefined, limit: 30 });
  } catch (err) {
    console.error("[visualizer] getIssueLifespans failed:", err);
    return [];
  }
}

async function safePatchCadence(): Promise<PatchCadencePoint[]> {
  try {
    return await getPatchCadence({ monthsBack: 18 });
  } catch (err) {
    console.error("[visualizer] getPatchCadence failed:", err);
    return [];
  }
}

async function safeScoreInputs(): Promise<ScoreInput[]> {
  try {
    return await getScoreInputs();
  } catch (err) {
    console.error("[visualizer] getScoreInputs failed:", err);
    return [];
  }
}

async function safeHeatmap(versions: string[]): Promise<AreaHeatmapCell[]> {
  try {
    return await getAreaHeatmap(versions);
  } catch (err) {
    console.error("[visualizer] getAreaHeatmap failed:", err);
    return [];
  }
}

async function safeMatrix(): Promise<{ rows: PackageMatrixRow[]; packages: string[] }> {
  try {
    return await getPackageEditorMatrix({ editorLimit: 14 });
  } catch (err) {
    console.error("[visualizer] getPackageEditorMatrix failed:", err);
    return { rows: [], packages: [] };
  }
}
