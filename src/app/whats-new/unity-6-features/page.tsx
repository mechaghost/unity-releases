import { firstQueryValue } from "@/lib/pagination";
import { filterUnity6Features, unity6Features } from "@/lib/unity6-features";
import { pageSocialMetadata } from "@/lib/site";
import { FeatureCard } from "../GuideParts";

export const dynamic = "force-dynamic";
const path = "/whats-new/unity-6-features";
const description = "Explore feature highlights across the Unity 6 family, including earlier releases. Search by feature and filter by version or category.";
export const metadata = {
  title: "Unity 6 feature highlights",
  description,
  alternates: { canonical: path },
  ...pageSocialMetadata({ title: "Unity 6 feature highlights", description, path })
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
export default async function Unity6FeaturesPage({ searchParams }: Props) {
  const params = await searchParams;
  const all = unity6Features();
  const versions = [...new Set(all.map(({ guide }) => guide.version))];
  const categories = [...new Set(all.map(({ feature }) => feature.category))].sort((a, b) => a.localeCompare(b));
  const q = firstQueryValue(params.q).trim();
  const requestedVersion = firstQueryValue(params.version);
  const requestedCategory = firstQueryValue(params.category);
  const version = versions.includes(requestedVersion) ? requestedVersion : "";
  const category = categories.includes(requestedCategory) ? requestedCategory : "";
  const results = filterUnity6Features(all, { q, version, category });
  return <div className="release-guide">
    <nav className="guide-breadcrumb" aria-label="Breadcrumb"><a href="/">What’s new</a><span aria-hidden="true"> / </span><span>Unity 6 features</span></nav>
    <header className="guide-hero">
      <h1>Unity 6 feature highlights</h1>
      <p>Explore features across the Unity 6 family, including earlier releases.</p>
      <p className="muted">These are selected launch highlights, not every release-note change. Availability depends on your Editor version and any listed requirements.</p>
    </header>
    <form action={path} method="get" className="filter-bar feature-catalog-filters" role="search" aria-label="Filter Unity 6 features">
      <label className="feature-catalog-search">Search features<input type="search" name="q" defaultValue={q} placeholder="Try lighting, UI Toolkit, or WebGPU" /></label>
      <label>Introduced in<select name="version" defaultValue={version}><option value="">All Unity 6 versions</option>{versions.map(value => <option key={value} value={value}>Unity {value}</option>)}</select></label>
      <label>Category<select name="category" defaultValue={category}><option value="">All categories</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <button className="btn btn--primary" type="submit">Apply filters</button>
      <a className="btn btn--secondary" href={path}>Clear filters</a>
    </form>
    <p className="feature-catalog-count" role="status">Showing <strong>{results.length}</strong> of {all.length} feature highlights</p>
    <section aria-label="Unity 6 feature highlights">
      <div className="guide-grid">{results.map(({ guide, feature }, index) => <FeatureCard key={feature.id} guide={guide} feature={feature} eager={index < 2} showVersion />)}</div>
      {results.length === 0 && <div className="empty-state"><h2>No matching features</h2><p>Try another search or <a href={path}>clear the filters</a> to see every highlight.</p></div>}
    </section>
    <footer className="guide-footer">Independent guides · <a href="/releases">Browse technical release notes</a> · <a href="/whats-new/past-releases">Past release guides</a></footer>
  </div>;
}
