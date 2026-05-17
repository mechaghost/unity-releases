import {
  getIssueDomainHeatmap,
  getIssueStats,
  getLongestOpenIssues,
  getMostMentionedIssues,
  getNewestIssues,
  searchIssues,
  type IssueHeatmapCell,
  type IssueRow,
  type IssueStats
} from "@/lib/issues";
import { listIngestionFreshness, type IngestionFreshness } from "@/lib/db/repositories";
import { pageSocialMetadata } from "@/lib/site";
import { IssueStatCards } from "./_components/IssueStatCards";
import { IssueTable } from "./_components/IssueTable";
import { IssueDomainHeatmap } from "./_components/IssueDomainHeatmap";
import { IssueSearchBox } from "./_components/IssueSearchBox";
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

export default async function IssueExplorerPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawQ = typeof params.q === "string" ? params.q : "";
  const query = rawQ.trim();
  const isSearch = query.length > 0;

  // In search mode the browse sections aren't needed — render only the
  // results table. Otherwise hit the normal four-section bundle.
  const [stats, longestOpen, newest, mostMentioned, heatmap, freshness, searchResults] =
    await Promise.all([
      safeStats(),
      isSearch ? Promise.resolve<IssueRow[]>([]) : safeLongestOpen(),
      isSearch ? Promise.resolve<IssueRow[]>([]) : safeNewest(),
      isSearch ? Promise.resolve<IssueRow[]>([]) : safeMostMentioned(),
      isSearch ? Promise.resolve<IssueHeatmapCell[]>([]) : safeHeatmap(),
      safeFreshness(),
      isSearch ? safeSearch(query) : Promise.resolve<IssueRow[]>([])
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

      <IssueSearchBox defaultQuery={rawQ} />

      <div className="issue-explorer__sections">
        {isSearch ? (
          <section className="viz-card">
            <div className="viz-card__header">
              <h2>
                Search results for <code>{query}</code>
              </h2>
            </div>
            <p className="viz-card__sub">
              Matches UUM-id substrings and the body of the issue&apos;s
              first Known-Issues mention. Up to 50 results, ordered by
              the most-recent mention.
            </p>
            <div className="viz-scroll">
              <IssueTable
                rows={searchResults}
                emptyMessage={`No issues match "${query}".`}
              />
            </div>
          </section>
        ) : null}

        {!isSearch ? (
          <>
            <IssueStatCards stats={stats} />

            <section className="viz-card">
              <div className="viz-card__header">
                <h2>Newest issues</h2>
              </div>
              <p className="viz-card__sub">
                Top 10 issues by first Known-Issues mention date — what
                Unity has flagged most recently, regardless of whether a
                fix is already shipped. Status pill on each row tells
                you whether it&apos;s still open.
              </p>
              <div className="viz-scroll">
                <IssueTable
                  rows={newest}
                  emptyMessage="No newly-flagged issues yet."
                />
              </div>
            </section>

            <section className="viz-card">
              <div className="viz-card__header">
                <h2>Longest-open issues</h2>
              </div>
              <p className="viz-card__sub">
                Top 10 issues by days-since-first-known-mention that
                still have no Fix mention (or whose latest Known-Issues
                mention is newer than every shipped Fix). Click an issue
                for the full mention history.
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
                Top 10 by distinct-release mention count. High counts
                often mean an issue Unity kept re-listing across patches,
                or a long-running regression that was fixed and
                re-introduced.
              </p>
              <div className="viz-scroll">
                <IssueTable
                  rows={mostMentioned}
                  emptyMessage="No issue mention data yet."
                />
              </div>
            </section>
          </>
        ) : null}
      </div>

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

async function safeNewest(): Promise<IssueRow[]> {
  try {
    return await getNewestIssues(10);
  } catch (err) {
    console.error("[issues] getNewestIssues failed:", err);
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

async function safeSearch(query: string): Promise<IssueRow[]> {
  try {
    return await searchIssues(query, 50);
  } catch (err) {
    console.error("[issues] searchIssues failed:", err);
    return [];
  }
}
