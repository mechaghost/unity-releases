import { listPackages } from "@/lib/db/repositories";
import { ExternalLink } from "../_components/ExternalLink";

export const dynamic = "force-dynamic";

type PackageRow = {
  name: string;
  display_name: string | null;
  description: string | null;
  source_url: string;
  latest_version: string | null;
  latest_published_at: string | null;
};

export default async function PackagesPage() {
  const packages = (await safeListPackages()) as PackageRow[];

  return (
    <>
      <section className="page-header">
        <div className="page-header__title-row">
          <h1>Packages</h1>
        </div>
        <p>{packages.length} official Unity packages tracked from the Unity package registry.</p>
      </section>

      <table className="dense-table">
        <thead>
          <tr>
            <th>Package</th>
            <th style={{ width: 140 }}>Latest</th>
            <th style={{ width: 130 }}>Updated</th>
            <th style={{ width: 200 }}>Links</th>
          </tr>
        </thead>
        <tbody>
          {packages.map((pkg) => (
            <tr key={pkg.name}>
              <td>
                <a className="link-internal--accent" href={`/packages/${encodeURIComponent(pkg.name)}`}>
                  <strong>{pkg.display_name ?? pkg.name}</strong>
                </a>
                <div className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: 12, marginTop: 2 }}>
                  {pkg.name}
                </div>
              </td>
              <td>
                <span className="chip chip--package tabnums">{pkg.latest_version ?? "—"}</span>
              </td>
              <td>
                <span className="muted tabnums">
                  {pkg.latest_published_at ? formatDate(pkg.latest_published_at) : "—"}
                </span>
              </td>
              <td>
                <span className="cluster" style={{ gap: 8 }}>
                  <ExternalLink href={pkg.source_url}>Registry</ExternalLink>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {packages.length === 0 ? (
        <div className="empty-state">
          <h2>No packages indexed yet.</h2>
          <p>Run <code>npm run ingest:packages</code> to fetch from the Unity registry.</p>
        </div>
      ) : null}
    </>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

async function safeListPackages() {
  try {
    return await listPackages(100);
  } catch {
    return [];
  }
}
