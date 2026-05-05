import { listPackages } from "@/lib/db/repositories";

export const dynamic = "force-dynamic";

export default async function PackagesPage() {
  const packages = await safeListPackages();

  return (
    <>
      <section className="page-header">
        <div>
          <h1>Packages</h1>
          <p className="muted">Official Unity packages tracked from the Unity package registry.</p>
        </div>
      </section>
      <div className="list">
        {packages.map((pkg) => (
          <article className="item" key={pkg.name}>
            <strong>{pkg.display_name ?? pkg.name}</strong>
            <p>{pkg.description ?? pkg.name}</p>
            <p className="muted">Latest: {pkg.latest_version ?? "Unknown"}</p>
            <div className="button-row">
              <a href={`/packages/${encodeURIComponent(pkg.name)}`}>Package detail</a>
              <a href={`/explorer?package=${encodeURIComponent(pkg.name)}`}>Release-note mentions</a>
              <a href={pkg.source_url}>Registry source</a>
            </div>
          </article>
        ))}
        {!packages.length ? <p className="muted">No packages have been indexed yet.</p> : null}
      </div>
    </>
  );
}

async function safeListPackages() {
  try {
    return await listPackages(100);
  } catch {
    return [];
  }
}
