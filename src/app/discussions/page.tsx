import {
  listDiscoursePosts,
  listDiscourseFilterFacets,
  getDiscoursePostStats,
  type DiscoursePostListItem,
  type DiscourseFacets,
  type DiscoursePostStats
} from "@/lib/db/repositories";
import { ExternalLink } from "../_components/ExternalLink";
import { Icon } from "../_components/Icon";
import { DiscussionsFilter } from "../_components/DiscussionsFilter";
import { pageSocialMetadata } from "@/lib/site";
import {
  DISCOURSE_BASE,
  avatarUrl,
  buildDiscussionsHref,
  normalizeSort
} from "@/lib/discussions-view";

export const dynamic = "force-dynamic";

const DISCUSSIONS_DESCRIPTION =
  "Unity staff posts from discussions.unity.com, tracked with an edit history — see what Unity employees are saying in the official community forum, filterable by category, author, and topic.";

export const metadata = {
  title: "Staff Discussions",
  description: DISCUSSIONS_DESCRIPTION,
  alternates: { canonical: "/discussions" },
  ...pageSocialMetadata({
    title: "Staff Discussions",
    description: DISCUSSIONS_DESCRIPTION,
    path: "/discussions"
  })
};

const PER_PAGE = 30;

type SearchParams = Promise<{
  q?: string | string[];
  category?: string | string[];
  author?: string | string[];
  sort?: string | string[];
  edited?: string | string[];
  topics?: string | string[];
  page?: string | string[];
}>;

export default async function DiscussionsPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = firstString(params.q);
  const categorySlug = firstString(params.category);
  const author = firstString(params.author);
  const sort = normalizeSort(firstString(params.sort));
  const editedOnly = firstString(params.edited) === "1";
  const topicsOnly = firstString(params.topics) === "1";
  const page = Math.max(1, parseInt(firstString(params.page) || "1", 10) || 1);

  const [facets, stats] = await Promise.all([safeFacets(), safeStats()]);

  // The filter UI speaks in category slugs (prettier URLs); the query
  // layer wants the upstream numeric id. Resolve via the facet list, and
  // silently drop an unknown slug rather than 404.
  const categoryId = categorySlug
    ? facets.categories.find((c) => c.slug === categorySlug)?.discourseCategoryId
    : undefined;

  const { items, total } = await safeListPosts({
    q: q || undefined,
    categoryIds: categoryId ? [categoryId] : undefined,
    usernames: author ? [author] : undefined,
    editedOnly,
    firstPostOnly: topicsOnly,
    sort,
    page,
    perPage: PER_PAGE
  });

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const start = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const end = Math.min(total, page * PER_PAGE);
  const filtered = Boolean(q || categorySlug || author || editedOnly || topicsOnly);

  const categoryOptions = facets.categories.map((c) => ({
    value: c.slug,
    label: c.name,
    count: c.count
  }));
  const authorOptions = facets.authors.map((a) => ({
    value: a.username,
    label: a.userTitle ? `${a.username} · ${a.userTitle}` : a.username,
    count: a.count
  }));

  const hrefFor = (targetPage: number) =>
    buildDiscussionsHref({
      q,
      category: categorySlug,
      author,
      sort,
      edited: editedOnly,
      topicsOnly,
      page: targetPage
    });

  return (
    <>
      <section className="page-header">
        <div className="page-header__title-row">
          <h1>Staff Discussions</h1>
        </div>
        <p>
          What Unity employees are saying on{" "}
          <ExternalLink href={DISCOURSE_BASE} className="link-internal--accent">
            discussions.unity.com
          </ExternalLink>
          . Only posts from accounts in Unity&apos;s staff group are tracked,
          and each post&apos;s edit history is kept so you can see when an answer
          changed. Click a title to read the full thread on Unity&apos;s forum.
        </p>
        <StatsStrip stats={stats} />
      </section>

      <DiscussionsFilter
        q={q}
        categorySlug={categorySlug}
        author={author}
        sort={sort}
        editedOnly={editedOnly}
        topicsOnly={topicsOnly}
        categories={categoryOptions}
        authors={authorOptions}
      />

      <div className="list-toolbar">
        <span className="list-toolbar__count">
          <strong className="tabnums">{total.toLocaleString()}</strong>{" "}
          {total === 1 ? "staff post" : "staff posts"}
          {q ? <> matching <code>{q}</code></> : null}
          {total > 0 ? (
            <> · showing {start.toLocaleString()}–{end.toLocaleString()}</>
          ) : null}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <h2>
            {filtered ? "No staff posts match these filters." : "No staff posts indexed yet."}
          </h2>
          <p>
            {filtered ? (
              <>Loosen the search, pick a different category or author, or untick Edited only.</>
            ) : (
              <>Run <code>npm run ingest:discussions</code> to poll the Unity staff forum.</>
            )}
          </p>
        </div>
      ) : (
        <ul className="discussion-list" aria-label="Unity staff posts">
          {items.map((post) => (
            <DiscussionCard key={post.id} post={post} />
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav className="lane__pagination" aria-label="Staff discussion pagination">
          <span className="lane__pagination-status">
            Page <strong className="tabnums">{page}</strong> of{" "}
            <strong className="tabnums">{totalPages}</strong>
          </span>
          <span className="lane__pagination-controls">
            {page > 1 ? (
              <a className="lane__pagination-btn" href={hrefFor(page - 1)} rel="prev">
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
            <span className="lane__pagination-page tabnums">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <a className="lane__pagination-btn" href={hrefFor(page + 1)} rel="next">
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
      ) : null}
    </>
  );
}

function StatsStrip({ stats }: { stats: DiscoursePostStats }) {
  return (
    <dl className="discussion-stats" aria-label="Discussion tracking stats">
      <div className="discussion-stats__item">
        <dt>Tracked posts</dt>
        <dd className="tabnums">{stats.totalPosts.toLocaleString()}</dd>
      </div>
      <div className="discussion-stats__item">
        <dt>Edited</dt>
        <dd className="tabnums">{stats.editedPosts.toLocaleString()}</dd>
      </div>
      <div className="discussion-stats__item">
        <dt>Staff (active)</dt>
        <dd className="tabnums">
          {stats.trackedStaff.toLocaleString()}
          {stats.activeStaff !== stats.trackedStaff ? (
            <span className="muted"> ({stats.activeStaff.toLocaleString()})</span>
          ) : null}
        </dd>
      </div>
      <div className="discussion-stats__item">
        <dt>Categories</dt>
        <dd className="tabnums">{stats.trackedCategories.toLocaleString()}</dd>
      </div>
      {stats.latestPostAt ? (
        <div className="discussion-stats__item">
          <dt>Latest</dt>
          <dd className="tabnums">{formatDate(stats.latestPostAt)}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function DiscussionCard({ post }: { post: DiscoursePostListItem }) {
  const title = post.topicTitle || `Post #${post.postNumber}`;
  const avatar = avatarUrl(post.avatarTemplate);
  return (
    <li className="discussion-card">
      <header className="discussion-card__head">
        <span className="discussion-card__author">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="discussion-card__avatar"
              src={avatar}
              alt=""
              width={24}
              height={24}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          ) : null}
          <span className="discussion-card__author-name">{post.username}</span>
          {post.userTitle ? (
            <span className="discussion-card__author-title muted">{post.userTitle}</span>
          ) : null}
        </span>
        {post.categoryName ? (
          <span className="chip discussion-card__category">{post.categoryName}</span>
        ) : null}
        {post.lastEditedAt ? (
          <span
            className="chip chip--reverse discussion-card__edited"
            title={post.editReason ? `Edited: ${post.editReason}` : "Edited after posting"}
          >
            Edited
          </span>
        ) : null}
        <span className="discussion-card__date muted tabnums">
          {formatDate(post.discourseCreatedAt)}
        </span>
      </header>

      <h2 className="discussion-card__title">
        <ExternalLink href={post.postUrl} className="link-internal--accent">
          {title}
        </ExternalLink>
      </h2>

      {post.excerpt ? <p className="discussion-card__excerpt">{post.excerpt}</p> : null}

      <footer className="discussion-card__meta">
        {post.tags.length > 0 ? (
          <ul className="discussion-card__tags">
            {post.tags.slice(0, 4).map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        ) : null}
        {post.replyCount > 0 ? (
          <span className="discussion-card__replies muted tabnums">
            {post.replyCount.toLocaleString()}{" "}
            {post.replyCount === 1 ? "reply" : "replies"}
          </span>
        ) : null}
      </footer>
    </li>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function firstString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return (value[0] ?? "").trim();
  return (value ?? "").trim();
}

async function safeFacets(): Promise<DiscourseFacets> {
  try {
    return await listDiscourseFilterFacets();
  } catch {
    return { categories: [], tags: [], authors: [] };
  }
}

async function safeStats(): Promise<DiscoursePostStats> {
  try {
    return await getDiscoursePostStats();
  } catch {
    return {
      totalPosts: 0,
      editedPosts: 0,
      deletedPosts: 0,
      trackedStaff: 0,
      activeStaff: 0,
      trackedCategories: 0,
      latestPostAt: null
    };
  }
}

async function safeListPosts(
  filters: Parameters<typeof listDiscoursePosts>[0]
): Promise<{ items: DiscoursePostListItem[]; total: number }> {
  try {
    return await listDiscoursePosts(filters);
  } catch {
    return { items: [], total: 0 };
  }
}
