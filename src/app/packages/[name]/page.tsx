import { getPackage } from "@/lib/db/repositories";
import { ExternalLink } from "../../_components/ExternalLink";

export const dynamic = "force-dynamic";

type PackageVersion = {
  id: number;
  version: string;
  published_at: string | null;
  unity_compatibility: string | null;
  is_prerelease: boolean;
  changelog: string | null;
};

export default async function PackagePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const data = await safePackage(decodeURIComponent(name));

  if (!data) {
    return (
      <div className="empty-state">
        <h2>Package not found</h2>
        <p>This package isn’t in the index yet. Run <code>npm run ingest:packages</code>.</p>
      </div>
    );
  }

  const versions = data.versions as PackageVersion[];
  const latest = versions[0];

  return (
    <>
      <section className="page-header">
        <div className="page-header__title-row">
          <h1>{data.package.display_name ?? data.package.name}</h1>
        </div>
        <p>
          <code>{data.package.name}</code>
          {data.package.description ? <> · {data.package.description}</> : null}
        </p>
        <div className="cluster" style={{ marginTop: 12 }}>
          {latest ? (
            <span className="chip chip--package tabnums">Latest: {latest.version}</span>
          ) : null}
          {data.package.documentation_url ? (
            <ExternalLink href={data.package.documentation_url}>Documentation</ExternalLink>
          ) : null}
          <ExternalLink href={data.package.source_url}>Registry</ExternalLink>
        </div>
      </section>

      <h2 style={{ fontSize: "var(--text-md)", margin: "var(--space-4) 0 var(--space-2)" }}>
        Version history ({versions.length.toLocaleString()})
      </h2>

      <div className="table-wrap"><table className="dense-table">
        <thead>
          <tr>
            <th style={{ width: 160 }}>Version</th>
            <th style={{ width: 130 }}>Published</th>
            <th style={{ width: 140 }}>Unity</th>
            <th style={{ width: 100 }}>Channel</th>
            <th>Changelog</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((version) => (
            <tr key={version.id}>
              <td>
                <span className="chip chip--package tabnums">{version.version}</span>
              </td>
              <td>
                <span className="muted tabnums">
                  {version.published_at ? formatDate(version.published_at) : "—"}
                </span>
              </td>
              <td>
                <span className="muted">{version.unity_compatibility ?? "—"}</span>
              </td>
              <td>
                {version.is_prerelease ? (
                  <span className="chip chip--impact-known_issue">Pre</span>
                ) : (
                  <span className="muted" style={{ fontSize: 12 }}>Stable</span>
                )}
              </td>
              <td>
                <span style={{ display: "block", maxWidth: 540, color: "var(--text-secondary)" }} title={version.changelog ?? ""}>
                  {version.changelog ? truncate(version.changelog, 120) : <span className="muted">—</span>}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
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

function truncate(value: string, n: number): string {
  if (value.length <= n) return value;
  return value.slice(0, n).trim() + "…";
}

async function safePackage(name: string) {
  try {
    return await getPackage(name);
  } catch {
    return null;
  }
}
