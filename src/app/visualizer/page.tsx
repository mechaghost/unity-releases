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
import { PackageDriftLog } from "./_components/PackageDriftLog";
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

/** Returns the raw param value when it was non-empty but failed to
 *  resolve to a known domain — so the page can surface "Unknown domain
 *  'X' — showing all data" instead of silently dropping the filter. */
function unknownDomainInput(
  raw: string | string[] | undefined,
  parsed: Domain | "Other" | null
): string | null {
  if (parsed != null) return null;
  if (typeof raw !== "string") return null;
  if (raw.trim() === "") return null;
  return raw;
}

export default async function VisualizerPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const domain = parseDomain(params.domain);
  const unknownDomain = unknownDomainInput(params.domain, domain);

  let partialLoad = false;
  const onLoadError = () => { partialLoad = true; };

  // Keep working charts visible when one query fails, while making the
  // partial failure explicit instead of presenting it as missing source data.
  const [versions, facts, freshness, lifespans, cadence, scoreInputs] = await Promise.all([
    safeVersionAggregates(domain, onLoadError),
    safeVersionFacts(domain, onLoadError),
    safeFreshness(onLoadError),
    safeIssueLifespans(domain, onLoadError),
    safePatchCadence(onLoadError),
    safeScoreInputs(onLoadError)
  ]);
  const { results: scoreResults } = scoreAllReleases(scoreInputs);
  // Build a version→ScoreInput lookup once so the leaderboard's
  // enrichment loop is O(n) instead of O(n²) over ~200 releases (the
  // earlier `scoreInputs.find` inside the .map was ~40k string
  // comparisons per render).
  const inputsByVersion = new Map(scoreInputs.map((s) => [s.version, s]));
  // Enrich each leaderboard row with the release's metadata (stream +
  // date) so the panel can show what version each badge belongs to
  // without forcing the user to hover.
  const leaderboardRows = [...scoreResults.values()].map((result) => {
    const meta = inputsByVersion.get(result.version);
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
    safeHeatmap(visibleVersionIds, onLoadError),
    safeMatrix(onLoadError)
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
          Counts come from indexed release notes. Build scores are calculated
          ratings; each chart explains its measure.
        </p>
      </section>

      <DomainFilterChips activeDomain={domain} />
      <p className="muted">Domain filters apply to stability, the known-issue trend, issue lifespans, and Top-10 facts. Other charts show all domains.</p>
      {partialLoad ? <div className="viz-warning" role="alert">Some charts could not load. <a href={domain ? `/visualizer?domain=${encodeURIComponent(domain)}` : "/visualizer"}>Try again</a>.</div> : null}

      {unknownDomain ? (
        <div className="viz-warning" role="alert">
          Unknown domain <code>{unknownDomain}</code> — showing all data.
          Use the chips above to filter to a known domain.
        </div>
      ) : null}

      <div className="viz-grid">
        <div className="viz-main">
          <StabilityHeatStrip versions={versions} />
          <BuildScoreLeaderboard rows={leaderboardRows} />
          <DecayCurve versions={versions} />
          <AreaHeatmap cells={heatmapCells} versions={versions} />
          <IssueLifespanLines issues={lifespans} />
          <PackageDriftLog rows={matrix.rows} packages={matrix.packages} />
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

async function safeVersionAggregates(domain: Domain | "Other" | null, onLoadError: () => void): Promise<VersionAggregate[]> {
  try {
    return await getVersionAggregates({ domain: domain ?? undefined, limit: 120 });
  } catch (err) {
    onLoadError();
    console.error("[visualizer] getVersionAggregates failed:", err);
    return [];
  }
}

async function safeVersionFacts(domain: Domain | "Other" | null, onLoadError: () => void): Promise<VersionFact[]> {
  try {
    return await getVersionFacts({ domain: domain ?? undefined });
  } catch (err) {
    onLoadError();
    console.error("[visualizer] getVersionFacts failed:", err);
    return [];
  }
}

async function safeFreshness(onLoadError: () => void): Promise<IngestionFreshness[]> {
  try {
    return await listIngestionFreshness();
  } catch (err) {
    onLoadError();
    console.error("[visualizer] listIngestionFreshness failed:", err);
    return [];
  }
}

async function safeIssueLifespans(domain: Domain | "Other" | null, onLoadError: () => void): Promise<IssueLifespan[]> {
  try {
    return await getIssueLifespans({ domain: domain ?? undefined, limit: 30 });
  } catch (err) {
    onLoadError();
    console.error("[visualizer] getIssueLifespans failed:", err);
    return [];
  }
}

async function safePatchCadence(onLoadError: () => void): Promise<PatchCadencePoint[]> {
  try {
    return await getPatchCadence({ monthsBack: 18 });
  } catch (err) {
    onLoadError();
    console.error("[visualizer] getPatchCadence failed:", err);
    return [];
  }
}

async function safeScoreInputs(onLoadError: () => void): Promise<ScoreInput[]> {
  try {
    return await getScoreInputs();
  } catch (err) {
    onLoadError();
    console.error("[visualizer] getScoreInputs failed:", err);
    return [];
  }
}

async function safeHeatmap(versions: string[], onLoadError: () => void): Promise<AreaHeatmapCell[]> {
  try {
    return await getAreaHeatmap(versions);
  } catch (err) {
    onLoadError();
    console.error("[visualizer] getAreaHeatmap failed:", err);
    return [];
  }
}

async function safeMatrix(onLoadError: () => void): Promise<{ rows: PackageMatrixRow[]; packages: string[] }> {
  try {
    // 30 rows so the drift log surfaces enough change events to be
    // useful — most editor releases don't bump curated packages, so a
    // smaller window mostly shows "no changes" rows.
    return await getPackageEditorMatrix({ editorLimit: 30 });
  } catch (err) {
    onLoadError();
    console.error("[visualizer] getPackageEditorMatrix failed:", err);
    return { rows: [], packages: [] };
  }
}
