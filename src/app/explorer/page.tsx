import { filtersFromSearchParams } from "@/lib/api";
import { searchReleaseNotes } from "@/lib/db/repositories";

export const dynamic = "force-dynamic";

export default async function ExplorerPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = toUrlSearchParams(await searchParams);
  const filters = filtersFromSearchParams(params);
  const results = await safeSearch(filters);

  return (
    <>
      <h1>Release Notes Explorer</h1>
      <form className="filters">
        <input name="q" placeholder="memory leak, UUM-136929, URP..." defaultValue={filters.q} />
        <input name="version" placeholder="6000.3.14f1" defaultValue={filters.version} />
        <input name="minorLine" placeholder="6000.3" defaultValue={filters.minorLine} />
        <input name="section" placeholder="Known Issues" defaultValue={filters.section} />
        <input name="area" placeholder="WebGL" defaultValue={filters.area} />
        <input name="platform" placeholder="WebGL" defaultValue={filters.platform} />
        <input name="package" placeholder="com.unity.inputsystem" defaultValue={filters.packageName} />
        <input name="issue" placeholder="UUM-136929" defaultValue={filters.issueId} />
        <button type="submit">Search</button>
      </form>
      <div className="list">
        {results.map((item) => (
          <article className="item" key={item.id ?? `${item.version}-${item.source_order}`}>
            <strong>
              {item.version} · {item.section} {item.area ? `· ${item.area}` : ""}
            </strong>
            <p>{item.body}</p>
            <p className="muted">
              {item.impact_kind} · {item.risk_level} · {(item.issue_ids ?? []).join(", ")}
            </p>
            <a href={item.source_url}>Official source</a>
          </article>
        ))}
        {!results.length && <p className="muted">No results yet, or the database is not configured.</p>}
      </div>
    </>
  );
}

async function safeSearch(filters: ReturnType<typeof filtersFromSearchParams>) {
  try {
    return await searchReleaseNotes(filters);
  } catch {
    return [];
  }
}

function toUrlSearchParams(input: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value) {
      params.set(key, value);
    }
  }
  return params;
}
