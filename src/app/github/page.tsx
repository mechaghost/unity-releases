import {
  listGithubRepos,
  listGithubRepoFacets,
  listGithubEvents,
  getGithubStats,
  type GithubRepoListItem,
  type GithubRepoFacets,
  type GithubEventItem,
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
  eventTypeLabel
} from "@/lib/github-view";
import { formatRelativeDate } from "@/lib/format-date";
import { pageSocialMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

const GITHUB_DESCRIPTION =
  "Unity's public GitHub org (Unity-Technologies): latest releases and pushes, newest projects, the most-starred and notable repos, and a searchable index of every public repository.";

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
  view?: string | string[];
  notable?: string | string[];
  archived?: string | string[];
  forks?: string | string[];
  page?: string | string[];
}>;

export default async function GithubPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = firstString(params.q);
  const language = firstString(params.lang);
  const topic = firstString(params.topic);
  const sort = normalizeGithubSort(firstString(params.sort));
  const isActivity = firstString(params.view) === "activity";
  const notableOnly = firstString(params.notable) === "1";
  const includeArchived = firstString(params.archived) === "1";
  const includeForks = firstString(params.forks) === "1";
  const page = Math.max(1, parseInt(firstString(params.page) || "1", 10) || 1);

  const [stats, facets, events, repos] = await Promise.all([
    safeStats(),
    safeFacets(),
    isActivity ? safeEvents(60) : Promise.resolve([]),
    isActivity
      ? Promise.resolve({ items: [], total: 0 })
      : safeListRepos({
          q: q || undefined,
          language: language || undefined,
          topic: topic || undefined,
          notableOnly,
          includeArchived,
          includeForks,
          sort,
          page,
          perPage: PER_PAGE
        })
  ]);
  const { items, total } = repos;

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const start = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const end = Math.min(total, page * PER_PAGE);
  const filtered = Boolean(q || language || topic || notableOnly);

  const languageOptions = facets.languages.map((l) => ({ value: l.language, label: l.language, count: l.count }));

  const activeTab = isActivity ? "activity" : sort;
  const hrefFor = (targetPage: number) =>
    buildGithubHref({
      q,
      language,
      topic,
      sort,
      notable: notableOnly,
      archived: includeArchived,
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
          What Unity ships in the open on{" "}
          <ExternalLink href={GITHUB_ORG_URL} className="link-internal--accent">
            github.com/Unity-Technologies
          </ExternalLink>{" "}
          — every public repo plus the live activity feed. Sort by stars,
          recent updates, newest, or forks; or switch to Activity for the
          latest releases, pushes, and new projects.
        </p>
        <StatsStrip stats={stats} />
      </section>

      <nav className="github-tabs" aria-label="Sort and view">
        {GITHUB_TABS.map((tab) => {
          const href = buildGithubHref(
            tab.view
              ? { view: tab.view }
              : { q, language, topic, sort: tab.sort, notable: notableOnly, archived: includeArchived, forks: includeForks }
          );
          return (
            <a
              key={tab.key}
              href={href}
              className="github-tabs__tab"
              aria-current={activeTab === tab.key ? "true" : undefined}
            >
              {tab.label}
            </a>
          );
        })}
      </nav>

      {isActivity ? (
        events.length === 0 ? (
          <div className="empty-state">
            <h2>No activity indexed yet.</h2>
            <p>The activity feed fills once the GitHub ingestion has run.</p>
          </div>
        ) : (
          <ul className="github-activity__list" aria-label="Latest GitHub activity">
            {events.map((ev) => (
              <ActivityRow key={ev.id} event={ev} />
            ))}
          </ul>
        )
      ) : (
        <>
          <GithubFilter
            q={q}
            language={language}
            sort={sort}
            notableOnly={notableOnly}
            includeArchived={includeArchived}
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
                <RepoCard key={repo.id} repo={repo} />
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
      )}
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

function ActivityRow({ event }: { event: GithubEventItem }) {
  const href = event.htmlUrl ?? `https://github.com/${event.repoFullName}`;
  return (
    <li className="github-activity__item">
      <span className={`github-activity__badge github-activity__badge--${event.eventType}`}>
        {eventTypeLabel(event.eventType)}
      </span>
      <span className="github-activity__body">
        <ExternalLink href={href} className="link-internal--accent github-activity__summary">
          {event.summary}
        </ExternalLink>
        <span className="github-activity__meta muted">
          <span className="github-activity__repo">{event.repoName}</span>
          <span aria-hidden="true"> · </span>
          <span className="github-activity__time tabnums">{formatRelativeDate(event.eventCreatedAt)}</span>
        </span>
      </span>
    </li>
  );
}

function RepoCard({ repo }: { repo: GithubRepoListItem }) {
  return (
    <li className="github-card">
      <header className="github-card__head">
        <h3 className="github-card__name">
          <ExternalLink href={repo.htmlUrl} className="link-internal--accent">
            {repo.name}
          </ExternalLink>
        </h3>
        {repo.isNotable ? <span className="chip github-card__notable">Notable</span> : null}
        {repo.isArchived ? <span className="chip chip--reverse">Archived</span> : null}
        {repo.isFork ? <span className="chip chip--reverse">Fork</span> : null}
      </header>

      {repo.description ? <p className="github-card__desc">{repo.description}</p> : null}

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

async function safeEvents(limit = 16): Promise<GithubEventItem[]> {
  try {
    return await listGithubEvents(limit);
  } catch {
    return [];
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
