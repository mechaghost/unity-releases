import { getPackage } from "@/lib/db/repositories";

export const dynamic = "force-dynamic";

export default async function PackagePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const data = await safePackage(decodeURIComponent(name));

  return (
    <>
      <h1>{decodeURIComponent(name)}</h1>
      {!data ? (
        <p className="muted">Package not found in the database yet.</p>
      ) : (
        <>
          <section className="panel">
            <p>{data.package.description}</p>
            {data.package.documentation_url && <a href={data.package.documentation_url}>Documentation</a>}
          </section>
          <h2>Versions</h2>
          <div className="list">
            {data.versions.map((version) => (
              <article className="item" key={version.id}>
                <strong>{version.version}</strong>
                <p className="muted">
                  Unity: {version.unity_compatibility ?? "Unknown"} · prerelease:{" "}
                  {String(version.is_prerelease)}
                </p>
                <p>{version.changelog}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}

async function safePackage(name: string) {
  try {
    return await getPackage(name);
  } catch {
    return null;
  }
}
