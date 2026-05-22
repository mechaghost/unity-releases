import {
  getIssueDomainHeatmap,
  getIssueStats,
  getLongestOpenIssues,
  getMostMentionedIssues,
  getNewestIssues,
  searchIssues,
  ISSUE_SEARCH_AREAS,
  ISSUE_SEARCH_STATUSES,
  ISSUE_SEARCH_SORT_KEYS,
  type IssueHeatmapCell,
  type IssueRow,
  type IssueSearchArea,
  type IssueSearchPage,
  type IssueSearchSort,
  type IssueSearchStatus,
  type IssueStats
} from "@/lib/issues";
import { listIngestionFreshness, type IngestionFreshness } from "@/lib/db/repositories";
import { pageSocialMetadata } from "@/lib/site";
import { Icon } from "@/app/_components/Icon";

const SEARCH_PAGE_SIZE = 25;
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
  const requestedPage = parsePage(params.page);
  const requestedStatus = parseStatus(params.status);
  const requestedSort = parseSort(params.sort);
  const requestedArea = parseArea(params.area);
  const requestedFixedWithin = parseFixedWithin(params.fixed_within);
  // Search mode kicks in for any of: text query, non-default status,
  // non-default area, non-null fixed_within window. Lets users drill
  // in from the heatmap or stat cards without typing anything.
  const isSearch =
    query.length > 0 ||
    requestedStatus !== "all" ||
    requestedArea !== "all" ||
    requestedFixedWithin !== null;

  const emptySearch: IssueSearchPage = {
    rows: [],
    total: 0,
    page: requestedPage,
    pageSize: SEARCH_PAGE_SIZE,
    totalPages: 0,
    status: requestedStatus,
    sort: requestedSort,
    area: requestedArea,
    fixedWithinDays: requestedFixedWithin,
    hasAnyFilter: false
  };
  const [stats, longestOpen, newest, mostMentioned, heatmap, freshness, searchPage] =
    await Promise.all([
      safeStats(),
      isSearch ? Promise.resolve<IssueRow[]>([]) : safeLongestOpen(),
      isSearch ? Promise.resolve<IssueRow[]>([]) : safeNewest(),
      isSearch ? Promise.resolve<IssueRow[]>([]) : safeMostMentioned(),
      isSearch ? Promise.resolve<IssueHeatmapCell[]>([]) : safeHeatmap(),
      safeFreshness(),
      isSearch
        ? safeSearch(
            query,
            requestedPage,
            requestedStatus,
            requestedSort,
            requestedArea,
            requestedFixedWithin
          )
        : Promise.resolve(emptySearch)
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
              <h2>{searchHeadline(query, searchPage)}</h2>
              {searchPage.total > 0 ? (
                <div className="viz-card__legend">
                  <SearchResultRange page={searchPage} />
                </div>
              ) : null}
            </div>
            <p className="viz-card__sub">
              {query.length > 0
                ? "Matches UUM-id substrings and the body of the issue's first Known-Issues mention."
                : "Filtered slice of every tracked UUM id — adjust the chips to widen or narrow."}
            </p>
            <SearchFilterChips
              query={query}
              sort={searchPage.sort}
              area={searchPage.area}
              fixedWithinDays={searchPage.fixedWithinDays}
              activeStatus={searchPage.status}
            />
            <SearchAreaChips
              query={query}
              sort={searchPage.sort}
              status={searchPage.status}
              fixedWithinDays={searchPage.fixedWithinDays}
              activeArea={searchPage.area}
            />
            <div className="viz-scroll">
              <IssueTable
                rows={searchPage.rows}
                emptyMessage={emptyResultsMessage(query, searchPage)}
                sortable={{
                  query,
                  status: searchPage.status,
                  area: searchPage.area,
                  fixedWithinDays: searchPage.fixedWithinDays,
                  current: searchPage.sort
                }}
              />
            </div>
            <SearchPagination page={searchPage} query={query} />
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

async function safeSearch(
  query: string,
  page: number,
  status: IssueSearchStatus,
  sort: IssueSearchSort,
  area: IssueSearchArea,
  fixedWithinDays: number | null
): Promise<IssueSearchPage> {
  try {
    return await searchIssues(query, {
      page,
      pageSize: SEARCH_PAGE_SIZE,
      status,
      sort,
      area,
      fixedWithinDays
    });
  } catch (err) {
    console.error("[issues] searchIssues failed:", err);
    return {
      rows: [],
      total: 0,
      page,
      pageSize: SEARCH_PAGE_SIZE,
      totalPages: 0,
      status,
      sort,
      area,
      fixedWithinDays,
      hasAnyFilter:
        query.length > 0 ||
        status !== "all" ||
        area !== "all" ||
        fixedWithinDays !== null
    };
  }
}

function parsePage(raw: string | string[] | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

function parseStatus(raw: string | string[] | undefined): IssueSearchStatus {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (ISSUE_SEARCH_STATUSES as readonly string[]).includes(v ?? "")
    ? (v as IssueSearchStatus)
    : "all";
}

function parseSort(raw: string | string[] | undefined): IssueSearchSort {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (ISSUE_SEARCH_SORT_KEYS as readonly string[]).includes(v ?? "")
    ? (v as IssueSearchSort)
    : "date-desc";
}

function parseArea(raw: string | string[] | undefined): IssueSearchArea {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (ISSUE_SEARCH_AREAS as readonly string[]).includes(v ?? "")
    ? (v as IssueSearchArea)
    : "all";
}

function parseFixedWithin(raw: string | string[] | undefined): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  // The DB layer clamps to MAX_FIXED_WITHIN_DAYS (365), so we don't
  // need to clamp here too — just reject obvious garbage.
  return Math.floor(n);
}

/** Single URL helper that preserves every search-mode param except the
 *  ones the caller is overriding. Switching status or sort drops the
 *  user back to page=1 (the previous page may not exist after the
 *  filter narrows results). */
function searchHref(opts: {
  q: string;
  page?: number;
  status?: IssueSearchStatus;
  sort?: IssueSearchSort;
  area?: IssueSearchArea;
  fixedWithinDays?: number | null;
}): string {
  const params = new URLSearchParams();
  if (opts.q.length > 0) params.set("q", opts.q);
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  if (opts.status && opts.status !== "all") params.set("status", opts.status);
  if (opts.sort && opts.sort !== "date-desc") params.set("sort", opts.sort);
  if (opts.area && opts.area !== "all") params.set("area", opts.area);
  if (opts.fixedWithinDays && opts.fixedWithinDays > 0) {
    params.set("fixed_within", String(opts.fixedWithinDays));
  }
  const qs = params.toString();
  return qs.length > 0 ? `/issues?${qs}` : "/issues";
}

const STATUS_LABELS: Record<IssueSearchStatus, string> = {
  all: "All",
  open: "Open",
  fixed: "Fixed",
  regressed: "Regressed"
};

function SearchFilterChips({
  query,
  sort,
  area,
  fixedWithinDays,
  activeStatus
}: {
  query: string;
  sort: IssueSearchSort;
  area: IssueSearchArea;
  fixedWithinDays: number | null;
  activeStatus: IssueSearchStatus;
}) {
  return (
    <div className="search-filter-chips" role="group" aria-label="Filter by status">
      {ISSUE_SEARCH_STATUSES.map((s) => (
        <a
          key={s}
          href={searchHref({ q: query, status: s, sort, area, fixedWithinDays })}
          className={`viz-chip ${activeStatus === s ? "viz-chip--active" : ""}`}
          aria-current={activeStatus === s ? "true" : undefined}
        >
          {STATUS_LABELS[s]}
        </a>
      ))}
    </div>
  );
}

function SearchAreaChips({
  query,
  sort,
  status,
  fixedWithinDays,
  activeArea
}: {
  query: string;
  sort: IssueSearchSort;
  status: IssueSearchStatus;
  fixedWithinDays: number | null;
  activeArea: IssueSearchArea;
}) {
  return (
    <div className="search-filter-chips" role="group" aria-label="Filter by subsystem">
      {ISSUE_SEARCH_AREAS.map((a) => (
        <a
          key={a}
          href={searchHref({ q: query, status, sort, area: a, fixedWithinDays })}
          className={`viz-chip ${activeArea === a ? "viz-chip--active" : ""}`}
          aria-current={activeArea === a ? "true" : undefined}
        >
          {a === "all" ? "All subsystems" : a}
        </a>
      ))}
    </div>
  );
}

function searchHeadline(query: string, page: IssueSearchPage): string {
  if (query.length > 0) return `Search results for "${query}"`;
  const parts: string[] = [];
  // Special case: status=fixed + fixedWithinDays both set roll up into
  // a single label so we don't render "Fixed · fixed in last 30d".
  if (page.status === "fixed" && page.fixedWithinDays !== null) {
    parts.push(`Fixed in last ${page.fixedWithinDays}d`);
  } else if (page.status === "all" && page.fixedWithinDays !== null) {
    // No status filter — the window is the only restriction, so make
    // it sentence-case as the leading label.
    parts.push(`Fixed in last ${page.fixedWithinDays}d`);
  } else {
    if (page.status !== "all") parts.push(STATUS_LABELS[page.status]);
    if (page.fixedWithinDays !== null) parts.push(`fixed in last ${page.fixedWithinDays}d`);
  }
  if (page.area !== "all") parts.push(page.area);
  if (parts.length === 0) return "Search results";
  return `${parts.join(" · ")} issues`;
}

function emptyResultsMessage(query: string, page: IssueSearchPage): string {
  if (query.length > 0) {
    const suffix: string[] = [];
    if (page.status !== "all") suffix.push(`status ${page.status}`);
    if (page.area !== "all") suffix.push(`subsystem ${page.area}`);
    if (page.fixedWithinDays !== null)
      suffix.push(`fixed within ${page.fixedWithinDays} days`);
    return `No issues match "${query}"${suffix.length > 0 ? ` with ${suffix.join(" and ")}` : ""}.`;
  }
  const parts: string[] = [];
  if (page.status !== "all") parts.push(page.status);
  if (page.area !== "all") parts.push(page.area);
  if (page.fixedWithinDays !== null) parts.push(`last ${page.fixedWithinDays}d`);
  return `No issues with ${parts.join(" · ") || "the current filters"}.`;
}

function SearchResultRange({ page }: { page: IssueSearchPage }) {
  if (page.total === 0) return null;
  const start = (page.page - 1) * page.pageSize + 1;
  const end = Math.min(page.total, page.page * page.pageSize);
  return (
    <span className="tabnums">
      <strong>{start.toLocaleString()}</strong>
      {end !== start ? <>–<strong>{end.toLocaleString()}</strong></> : null} of{" "}
      <strong>{page.total.toLocaleString()}</strong>
    </span>
  );
}

function SearchPagination({ page, query }: { page: IssueSearchPage; query: string }) {
  if (page.totalPages <= 1) return null;
  const hasPrev = page.page > 1;
  const hasNext = page.page < page.totalPages;
  return (
    <nav className="lane__pagination" aria-label="Search results pagination">
      <span className="lane__pagination-status">
        Page <strong className="tabnums">{page.page}</strong> of{" "}
        <strong className="tabnums">{page.totalPages}</strong>
      </span>
      <span className="lane__pagination-controls">
        {hasPrev ? (
          <a
            className="lane__pagination-btn"
            href={searchHref({ q: query, page: page.page - 1, status: page.status, sort: page.sort, area: page.area, fixedWithinDays: page.fixedWithinDays })}
            rel="prev"
          >
            <Icon name="chevron-left" size={14} />
            Prev
          </a>
        ) : (
          <span
            className="lane__pagination-btn lane__pagination-btn--disabled"
            aria-disabled="true"
          >
            <Icon name="chevron-left" size={14} />
            Prev
          </span>
        )}
        {hasNext ? (
          <a
            className="lane__pagination-btn"
            href={searchHref({ q: query, page: page.page + 1, status: page.status, sort: page.sort, area: page.area, fixedWithinDays: page.fixedWithinDays })}
            rel="next"
          >
            Next
            <Icon name="chevron-right" size={14} />
          </a>
        ) : (
          <span
            className="lane__pagination-btn lane__pagination-btn--disabled"
            aria-disabled="true"
          >
            Next
            <Icon name="chevron-right" size={14} />
          </span>
        )}
      </span>
    </nav>
  );
}
