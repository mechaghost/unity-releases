import {
  listGithubRepos,
  listGithubRepoFacets,
  getReposLatestActivity,
  getGithubStats,
  type GithubRepoListItem,
  type GithubRepoFacets,
  type RepoLatestActivity,
  type GithubStats
} from "@/lib/db/repositories";
import { ExternalLink } from "../_components/ExternalLink";
import { Icon } from "../_components/Icon";
import { GithubFilter } from "../_components/GithubFilter";
import {
  GITHUB_ORG_URL,
  GITHUB_TABS,
  buildGithubHref,
  formatCompact,
  normalizeGithubSort,
  normalizeGithubDir,
  flipGithubDir
} from "@/lib/github-view";
import { formatRelativeDate } from "@/lib/format-date";
import { pageSocialMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

const GITHUB_DESCRIPTION =
  "Which Unity-Technologies repositories are actively being worked on right now — the latest commit on each, recent releases, and a searchable index of every public Unity repo.";

export const metadata = {
  title: "Unity GitHub",
  description: GITHUB_DESCRIPTION,
  alternates: { canonical: "/github" },
  ...pageSocialMetadata({ title: "Unity GitHub", description: GITHUB_DESCRIPTION, path: "/github" })
};

const PER_PAGE = 30;

type SearchParams = Promise<{
  q?: string | string[];
  lang?: string | string[];
  topic?: string | string[];
  sort?: string | string[];
  dir?: string | string[];
  notable?: string | string[];
  forks?: string | string[];
  page?: string | string[];
}>;

export default async function GithubPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = firstString(params.q);
  const language = firstString(params.lang);
  const topic = firstString(params.topic);
  const sort = normalizeGithubSort(firstString(params.sort));
  const dir = normalizeGithubDir(firstString(params.dir));
  const notableOnly = firstString(params.notable) === "1";
  const includeForks = firstString(params.forks) === "1";
  const page = Math.max(1, parseInt(firstString(params.page) || "1", 10) || 1);

  // When the user is searching by name, span everything (archived + forks)
  // so a specific repo is findable even if it's archived or a fork — those
  // are only hidden from the default *browse*, not from explicit search.
  const searching = q.length > 0;

  const [stats, facets, { items, total }] = await Promise.all([
    safeStats(),
    safeFacets(),
    safeListRepos({
      q: q || undefined,
      language: language || undefined,
      topic: topic || undefined,
      notableOnly,
      includeArchived: searching,
      includeForks: searching || includeForks,
      sort,
      direction: dir,
      page,
      perPage: PER_PAGE
    })
  ]);

  // Latest commit / release for just the repos on this page, derived from
  // the activity we already ingest (no extra GitHub calls).
  const activity = await safeActivity(items.map((r) => r.fullName));

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const start = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const end = Math.min(total, page * PER_PAGE);
  const filtered = Boolean(q || language || topic || notableOnly);

  const languageOptions = facets.languages.map((l) => ({ value: l.language, label: l.language, count: l.count }));

  const hrefFor = (targetPage: number) =>
    buildGithubHref({
      q,
      language,
      topic,
      sort,
      dir,
      notable: notableOnly,
      forks: includeForks,
      page: targetPage
    });

  return (
    <>
      <section className="page-header">
        <div className="page-header__title-row">
          <h1>Unity GitHub</h1>
        </div>
        <p>
          Which repos Unity is actively working on in the open on{" "}
          <ExternalLink href={GITHUB_ORG_URL} className="link-internal--accent">
            github.com/Unity-Technologies
          </ExternalLink>
          . Sorted by most recent activity by default — each card shows the
          latest commit and flags new releases. Tap a repo to explore it on
          GitHub.
        </p>
        <StatsStrip stats={stats} />
      </section>

      <nav className="github-tabs" aria-label="Sort">
        {GITHUB_TABS.map((tab) => {
          const isActive = sort === tab.key;
          // Clicking the active sort reverses its direction; clicking an
          // inactive sort switches to it (descending).
          const nextDir = isActive ? flipGithubDir(dir) : "desc";
          return (
            <a
              key={tab.key}
              href={buildGithubHref({
                q,
                language,
                topic,
                sort: tab.sort,
                dir: nextDir,
                notable: notableOnly,
                forks: includeForks
              })}
              className="github-tabs__tab"
              aria-current={isActive ? "true" : undefined}
              title={
                isActive
                  ? `${tab.label} — ${dir === "desc" ? "descending" : "ascending"}, click to reverse`
                  : `Sort by ${tab.label.toLowerCase()}`
              }
            >
              {tab.label}
              {isActive ? (
                <Icon
                  name={dir === "desc" ? "chevron-down" : "chevron-up"}
                  size={14}
                  className="github-tabs__dir"
                />
              ) : null}
            </a>
          );
        })}
      </nav>

      <GithubFilter
        q={q}
        language={language}
        sort={sort}
        dir={dir}
        notableOnly={notableOnly}
        includeForks={includeForks}
        languages={languageOptions}
      />

      <div className="list-toolbar">
        <span className="list-toolbar__count">
          <strong className="tabnums">{total.toLocaleString()}</strong>{" "}
          {total === 1 ? "repository" : "repositories"}
          {q ? <> matching <code>{q}</code></> : null}
          {total > 0 ? <> · showing {start.toLocaleString()}–{end.toLocaleString()}</> : null}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <h2>{filtered ? "No repositories match these filters." : "No repositories indexed yet."}</h2>
          <p>
            {filtered ? (
              <>Loosen the search, clear the language, or untick Notable only.</>
            ) : (
              <>Run <code>npm run ingest:github</code> (with <code>GITHUB_TOKEN</code> set) to mirror the Unity-Technologies org.</>
            )}
          </p>
        </div>
      ) : (
        <ul className="github-grid" aria-label="Unity-Technologies repositories">
          {items.map((repo) => (
            <RepoCard key={repo.id} repo={repo} activity={activity.get(repo.fullName)} />
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav className="lane__pagination" aria-label="Repository pagination">
          <span className="lane__pagination-status">
            Page <strong className="tabnums">{page}</strong> of{" "}
            <strong className="tabnums">{totalPages}</strong>
          </span>
          <span className="lane__pagination-controls">
            {page > 1 ? (
              <a className="lane__pagination-btn" href={hrefFor(page - 1)} rel="prev">
                <Icon name="chevron-left" size={14} /> Prev
              </a>
            ) : (
              <span className="lane__pagination-btn lane__pagination-btn--disabled" aria-disabled="true">
                <Icon name="chevron-left" size={14} /> Prev
              </span>
            )}
            <span className="lane__pagination-page tabnums">Page {page} of {totalPages}</span>
            {page < totalPages ? (
              <a className="lane__pagination-btn" href={hrefFor(page + 1)} rel="next">
                Next <Icon name="chevron-right" size={14} />
              </a>
            ) : (
              <span className="lane__pagination-btn lane__pagination-btn--disabled" aria-disabled="true">
                Next <Icon name="chevron-right" size={14} />
              </span>
            )}
          </span>
        </nav>
      ) : null}
    </>
  );
}

function StatsStrip({ stats }: { stats: GithubStats }) {
  return (
    <dl className="discussion-stats" aria-label="GitHub tracking stats">
      <Stat label="Repos" value={stats.activeRepos.toLocaleString()} />
      <Stat label="Total stars" value={formatCompact(stats.totalStars)} />
      <Stat label="Notable" value={stats.notableRepos.toLocaleString()} />
      <Stat label="Languages" value={stats.languages.toLocaleString()} />
      {stats.latestEventAt ? <Stat label="Last activity" value={formatRelativeDate(stats.latestEventAt)} /> : null}
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="discussion-stats__item">
      <dt>{label}</dt>
      <dd className="tabnums">{value}</dd>
    </div>
  );
}

function RepoCard({ repo, activity }: { repo: GithubRepoListItem; activity?: RepoLatestActivity }) {
  const commit = activity?.commitMessage?.trim();
  return (
    <li className="github-card">
      <header className="github-card__head">
        <h3 className="github-card__name">
          <ExternalLink href={repo.htmlUrl} className="link-internal--accent">
            {repo.name}
          </ExternalLink>
        </h3>
        {activity?.releaseTag ? (
          <span className="chip github-card__release" title="Recent release">
            Released {activity.releaseTag}
          </span>
        ) : null}
        {repo.isNotable ? <span className="chip github-card__notable">Notable</span> : null}
        {repo.isArchived ? <span className="chip chip--reverse">Archived</span> : null}
        {repo.isFork ? <span className="chip chip--reverse">Fork</span> : null}
      </header>

      {commit ? (
        <p className="github-card__commit" title="Latest commit">
          <Icon name="git-compare" size={12} className="github-card__commit-icon" />
          <span>{commit}</span>
        </p>
      ) : repo.description ? (
        <p className="github-card__desc">{repo.description}</p>
      ) : null}

      {repo.topics.length > 0 ? (
        <ul className="github-card__topics">
          {repo.topics.slice(0, 4).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      ) : null}

      <footer className="github-card__meta muted">
        <span className="github-card__stat" title="Stars">
          <Icon name="star" size={13} /> {formatCompact(repo.stars)}
        </span>
        <span className="github-card__stat" title="Forks">
          <Icon name="git-compare" size={13} /> {formatCompact(repo.forks)}
        </span>
        {repo.language ? <span className="github-card__lang">{repo.language}</span> : null}
        {repo.repoPushedAt ? (
          <span className="github-card__pushed tabnums">Updated {formatRelativeDate(repo.repoPushedAt)}</span>
        ) : null}
      </footer>
    </li>
  );
}

function firstString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return (value[0] ?? "").trim();
  return (value ?? "").trim();
}

async function safeStats(): Promise<GithubStats> {
  try {
    return await getGithubStats();
  } catch {
    return { totalRepos: 0, activeRepos: 0, totalStars: 0, notableRepos: 0, languages: 0, latestPushAt: null, latestEventAt: null };
  }
}

async function safeFacets(): Promise<GithubRepoFacets> {
  try {
    return await listGithubRepoFacets();
  } catch {
    return { languages: [], topics: [] };
  }
}

async function safeActivity(fullNames: string[]): Promise<Map<string, RepoLatestActivity>> {
  try {
    return await getReposLatestActivity(fullNames);
  } catch {
    return new Map();
  }
}

async function safeListRepos(
  filters: Parameters<typeof listGithubRepos>[0]
): Promise<{ items: GithubRepoListItem[]; total: number }> {
  try {
    return await listGithubRepos(filters);
  } catch {
    return { items: [], total: 0 };
  }
}
