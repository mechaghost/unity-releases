import {
  getIssueDomainHeatmap,
  getIssueStats,
  getLongestOpenIssues,
  getMostMentionedIssues,
  type IssueHeatmapCell,
  type IssueRow,
  type IssueStats
} from "@/lib/issues";
import { listIngestionFreshness, type IngestionFreshness } from "@/lib/db/repositories";
import { pageSocialMetadata } from "@/lib/site";
import { IssueStatCards } from "./_components/IssueStatCards";
import { IssueTable } from "./_components/IssueTable";
import { IssueDomainHeatmap } from "./_components/IssueDomainHeatmap";
import { TrustRail } from "../visualizer/_components/TrustRail";

export const revalidate = 300;

const PAGE_DESCRIPTION =
  "Issue Explorer — the longest-open Unity issues, where they cluster by subsystem, and which UUM ids Unity has re-listed the most across the indexed release corpus.";

export const metadata = {
  title: "Issue Explorer",
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/issues" },
  ...pageSocialMetadata({ title: "Issue Explorer", description: PAGE_DESCRIPTION, path: "/issues" })
};

export default async function IssueExplorerPage() {
  // Every read is wrapped — a slow query or schema mismatch on one
  // section shouldn't take the whole page down. Matches the pattern
  // CLAUDE.md requires for resilient deploys.
  const [stats, longestOpen, mostMentioned, heatmap, freshness] = await Promise.all([
    safeStats(),
    safeLongestOpen(),
    safeMostMentioned(),
    safeHeatmap(),
    safeFreshness()
  ]);

  return (
    <>
      <section className="page-header">
        <h1>Issue Explorer</h1>
        <p>
          Status, longest-open, and most-mentioned cuts of every UUM-id
          referenced in the indexed Unity release-note corpus. Click any
          issue to see every release that mentioned it.
        </p>
      </section>

      <IssueStatCards stats={stats} />

      <section className="viz-card">
        <div className="viz-card__header">
          <h2>Longest-open issues</h2>
        </div>
        <p className="viz-card__sub">
          Top 10 issues by days-since-first-known-mention that still
          have no Fix mention (or whose latest Known-Issues mention is
          newer than every shipped Fix). Click an issue for the full
          mention history.
        </p>
        <div className="viz-scroll">
          <IssueTable
            rows={longestOpen}
            emptyMessage="No long-living open issues — either ingestion is fresh or Unity has been shipping fixes fast."
          />
        </div>
      </section>

      <IssueDomainHeatmap cells={heatmap} />

      <section className="viz-card">
        <div className="viz-card__header">
          <h2>Most-mentioned issues</h2>
        </div>
        <p className="viz-card__sub">
          Top 10 by distinct-release mention count. High counts often
          mean an issue Unity kept re-listing across patches, or a
          long-running regression that was fixed and re-introduced.
        </p>
        <div className="viz-scroll">
          <IssueTable
            rows={mostMentioned}
            emptyMessage="No issue mention data yet."
          />
        </div>
      </section>

      <TrustRail freshness={freshness} />
    </>
  );
}

async function safeStats(): Promise<IssueStats> {
  try {
    return await getIssueStats();
  } catch (err) {
    console.error("[issues] getIssueStats failed:", err);
    return { total: 0, currentlyOpen: 0, fixedRecently: 0, regressed: 0 };
  }
}

async function safeLongestOpen(): Promise<IssueRow[]> {
  try {
    return await getLongestOpenIssues(10);
  } catch (err) {
    console.error("[issues] getLongestOpenIssues failed:", err);
    return [];
  }
}

async function safeMostMentioned(): Promise<IssueRow[]> {
  try {
    return await getMostMentionedIssues(10);
  } catch (err) {
    console.error("[issues] getMostMentionedIssues failed:", err);
    return [];
  }
}

async function safeHeatmap(): Promise<IssueHeatmapCell[]> {
  try {
    return await getIssueDomainHeatmap();
  } catch (err) {
    console.error("[issues] getIssueDomainHeatmap failed:", err);
    return [];
  }
}

async function safeFreshness(): Promise<IngestionFreshness[]> {
  try {
    return await listIngestionFreshness();
  } catch (err) {
    console.error("[issues] listIngestionFreshness failed:", err);
    return [];
  }
}
