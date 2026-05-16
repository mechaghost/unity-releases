import type { PackageMatrixRow } from "@/lib/visualizer";

/**
 * Editor × package compatibility table. For each recent editor release
 * row, shows the resolved-at-the-time package version per curated
 * package. Cells flag where the package version changed between
 * consecutive editor releases — that's where most upgrade pain comes
 * from in practice.
 */
export function PackageEditorMatrix({
  rows,
  packages
}: {
  rows: PackageMatrixRow[];
  packages: string[];
}) {
  if (rows.length === 0 || packages.length === 0) {
    return (
      <div className="viz-card">
        <h2>Editor × package compatibility</h2>
        <p className="muted">No package history yet.</p>
      </div>
    );
  }

  // Sort newest editor first for the matrix (rows ordered top → bottom),
  // and compute per-row change flags by comparing to the *next* row (i.e.
  // the prior editor release) so the most recent editor never carries
  // false "changed" markers.
  const ordered = rows;
  const changed = new Map<string, boolean>();
  for (let i = 0; i < ordered.length; i++) {
    const cur = ordered[i];
    const prev = ordered[i + 1];
    for (const pkg of packages) {
      const curV = cur.packages[pkg]?.version ?? null;
      const prevV = prev?.packages[pkg]?.version ?? null;
      const key = `${cur.editorVersion}::${pkg}`;
      changed.set(key, prev != null && curV != null && prevV != null && curV !== prevV);
    }
  }

  return (
    <div className="viz-card">
      <div className="viz-card__header">
        <h2>Editor × package compatibility</h2>
        <div className="viz-card__legend">
          <span className="viz-legend-swatch viz-legend-swatch--change" /> changed since prior editor
        </div>
      </div>
      <p className="viz-card__sub">
        For each recent editor release, the latest package version
        published on-or-before that editor&apos;s release date. Highlighted
        cells = package version changed between consecutive editors.
      </p>
      <div className="viz-scroll">
        <table className="viz-matrix">
          <thead>
            <tr>
              <th className="viz-matrix__editor">Editor</th>
              <th className="viz-matrix__date">Released</th>
              {packages.map((p) => (
                <th key={p} className="viz-matrix__pkg" title={p}>
                  {shortPackageName(p)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => (
              <tr key={row.editorVersion}>
                <td className="viz-matrix__editor">
                  <a href={`/releases/${encodeURIComponent(row.editorVersion)}`}>
                    {row.editorVersion}
                  </a>
                </td>
                <td className="viz-matrix__date muted">
                  {row.editorDate ? row.editorDate.slice(0, 10) : "—"}
                </td>
                {packages.map((p) => {
                  const cell = row.packages[p];
                  const did = changed.get(`${row.editorVersion}::${p}`) ?? false;
                  return (
                    <td
                      key={p}
                      className={`viz-matrix__cell ${did ? "viz-matrix__cell--changed" : ""}`}
                      title={p}
                    >
                      {cell?.version ?? "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function shortPackageName(name: string): string {
  // com.unity.foo.bar → foo.bar
  return name.replace(/^com\.unity\./, "");
}
