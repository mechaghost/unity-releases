import { serializeWatchQuery } from "@/lib/watch";

export default async function WatchPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const watch = serializeWatchQuery({
    q: stringParam(params.q),
    minorLine: stringParam(params.minorLine),
    packages: arrayParam(params.package),
    platforms: arrayParam(params.platform),
    impacts: arrayParam(params.impact),
    risks: arrayParam(params.risk)
  });
  const rssPath = `/rss${watch ? `?${watch}` : ""}`;

  return (
    <>
      <h1>Watch URL Builder</h1>
      <form className="filters">
        <input name="q" placeholder="Keyword" defaultValue={stringParam(params.q)} />
        <input name="minorLine" placeholder="6000.3" defaultValue={stringParam(params.minorLine)} />
        <input name="package" placeholder="com.unity.inputsystem" defaultValue={stringParam(params.package)} />
        <input name="platform" placeholder="WebGL" defaultValue={stringParam(params.platform)} />
        <input name="impact" placeholder="known_issue" defaultValue={stringParam(params.impact)} />
        <input name="risk" placeholder="caution" defaultValue={stringParam(params.risk)} />
        <button type="submit">Build URL</button>
      </form>
      <section className="panel">
        <p>
          Shareable RSS: <code>{rssPath}</code>
        </p>
        <a href={rssPath}>Open RSS feed</a>
      </section>
    </>
  );
}

function arrayParam(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function stringParam(value: string | string[] | undefined): string {
  if (!value) return "";
  return Array.isArray(value) ? value[0] : value;
}
