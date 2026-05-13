import { listResources, type ResourceRow } from "@/lib/db/repositories";
import { ExternalLink } from "../_components/ExternalLink";
import { ResourcesFilter } from "../_components/ResourcesFilter";
import { pageSocialMetadata } from "@/lib/site";

export const dynamic = "force-dynamic";

const RESOURCES_DESCRIPTION =
  "Unity 6 ebooks, videos, webinars, podcasts, and dev articles, with the marketing/enterprise content filtered out by default. Pulled from Unity's public resources hub.";

export const metadata = {
  title: "Resources",
  description: RESOURCES_DESCRIPTION,
  alternates: { canonical: "/resources" },
  ...pageSocialMetadata({
    title: "Resources",
    description: RESOURCES_DESCRIPTION,
    path: "/resources"
  })
};

const KNOWN_TYPES = ["E-book", "Video", "Webinar", "Podcast", "Article", "Tutorial"] as const;

type SearchParams = Promise<{
  q?: string | string[];
  type?: string | string[];
  marketing?: string | string[];
  enterprise?: string | string[];
}>;

export default async function ResourcesPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = firstString(params.q);
  const types = collectStrings(params.type).filter((t) => (KNOWN_TYPES as readonly string[]).includes(t));
  const includeMarketing = firstString(params.marketing) === "1";
  const includeEnterprise = firstString(params.enterprise) === "1";

  const { rows, total } = await safeListResources({
    includeMarketing,
    includeEnterprise,
    types: types.length > 0 ? types : undefined,
    q: q || undefined,
    limit: 200
  });

  return (
    <>
      <section className="page-header">
        <div className="page-header__title-row">
          <h1>Resources</h1>
        </div>
        <p>
          Unity ebooks, videos, webinars, podcasts, and dev articles. Marketing
          (case studies, reports, whitepapers) and enterprise content
          (non-games industries) are hidden by default - toggle them below to
          see the full library.
        </p>
      </section>

      <ResourcesFilter
        q={q}
        selectedTypes={types}
        knownTypes={KNOWN_TYPES}
        includeMarketing={includeMarketing}
        includeEnterprise={includeEnterprise}
      />

      <div className="list-toolbar">
        <span className="list-toolbar__count">
          <strong>{total.toLocaleString()}</strong>{" "}
          {total === 1 ? "resource" : "resources"}
          {q ? <> matching <code>{q}</code></> : null}
          {rows.length < total ? <> · showing {rows.length}</> : null}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          <h2>No resources match these filters.</h2>
          <p>
            Loosen the search, untick a type, or enable Marketing / Enterprise
            above.
          </p>
        </div>
      ) : (
        <ul className="resources-grid" aria-label="Unity resources">
          {rows.map((row) => (
            <ResourceCard key={row.slug} row={row} />
          ))}
        </ul>
      )}
    </>
  );
}

function ResourceCard({ row }: { row: ResourceRow }) {
  return (
    <li className="resource-card">
      <header className="resource-card__head">
        {row.resource_type ? (
          <span className="resource-card__type">{row.resource_type}</span>
        ) : null}
        {row.is_gated ? (
          <span className="chip chip--reverse" title="Requires a Salesforce form fill on Unity's site">
            Gated
          </span>
        ) : null}
        {row.resource_date ? (
          <span className="resource-card__date muted tabnums">
            {formatDate(row.resource_date)}
          </span>
        ) : null}
      </header>
      <h2 className="resource-card__title">
        <ExternalLink href={row.url} className="link-internal--accent">
          {row.title}
        </ExternalLink>
      </h2>
      {row.summary ? (
        <p className="resource-card__summary">{row.summary}</p>
      ) : null}
      {row.topics.length > 0 ? (
        <ul className="resource-card__topics">
          {row.topics.slice(0, 3).map((topic) => (
            <li key={topic}>{topic}</li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function firstString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return (value[0] ?? "").trim();
  return (value ?? "").trim();
}
function collectStrings(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (value !== undefined) return [value];
  return [];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

async function safeListResources(filters: Parameters<typeof listResources>[0]) {
  try {
    return await listResources(filters);
  } catch {
    return { rows: [], total: 0 };
  }
}
