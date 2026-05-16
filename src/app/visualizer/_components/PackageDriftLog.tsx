import type { PackageMatrixRow } from "@/lib/visualizer";
import { VersionPill } from "@/app/_components/VersionPill";
import { formatReleaseDate } from "@/lib/format-date";

type PackageChange = {
  name: string;
  from: string | null;
  to: string | null;
};

/**
 * Chronological log of package version changes between consecutive
 * editor releases.
 *
 * The data layer (`getPackageEditorMatrix`) still produces a dense
 * editor×package matrix — but rendering all those cells made unchanged
 * values dominate the visual, drowning out the actual signal. This
 * component flips the presentation: for each editor release in the
 * window, show ONLY the curated packages whose version differs from
 * the prior editor release. Empty rows ("no package changes from
 * prior patch") are shown explicitly because that's a useful negative
 * signal too.
 *
 * Cross-stream comparisons are intentional — if the previous indexed
 * editor was on a different minor_line, the "delta" reflects what a
 * user upgrading across lines would experience.
 */
export function PackageDriftLog({
  rows,
  packages
}: {
  rows: PackageMatrixRow[];
  packages: string[];
}) {
  if (rows.length === 0 || packages.length === 0) {
    return (
      <div className="viz-card">
        <h2>Package drift between editor releases</h2>
        <p className="muted">No package history yet.</p>
      </div>
    );
  }

  // Newest first (already sorted by the data layer). Compute deltas
  // against the *next* row (the prior editor release) so the oldest
  // visible row has no comparison anchor.
  const entries = rows.map((row, i) => ({
    row,
    prior: rows[i + 1] ?? null,
    changes: diffPackages(row, rows[i + 1] ?? null, packages)
  }));

  return (
    <div className="viz-card">
      <div className="viz-card__header">
        <h2>Package drift between editor releases</h2>
      </div>
      <p className="viz-card__sub">
        For each recent editor release, the curated packages whose
        version changed since the prior indexed editor. Unchanged
        packages are omitted — entries that show no changes mean no
        curated package bumped between consecutive editors.
      </p>
      <ol className="viz-package-drift" aria-label="Package version changes per editor release">
        {entries.map(({ row, prior, changes }) => {
          const empty = prior != null && changes.length === 0;
          const baseline = prior == null;
          return (
            <li
              key={row.editorVersion}
              className={`viz-package-drift__entry ${
                empty ? "viz-package-drift__entry--empty" : ""
              } ${baseline ? "viz-package-drift__entry--baseline" : ""}`}
            >
              <div className="viz-package-drift__head">
                <VersionPill version={row.editorVersion} stream={row.stream} />
                {row.editorDate ? (
                  <span className="viz-package-drift__date muted">
                    {formatReleaseDate(row.editorDate)}
                  </span>
                ) : null}
                {/* For compact rows the "no changes" / "baseline" note
                    rides inline with the header — saves vertical space
                    since these dominate the timeline when curated
                    packages don't bump every patch. */}
                {empty ? (
                  <span className="viz-package-drift__inline-note muted">
                    no curated package changes
                  </span>
                ) : null}
                {baseline ? (
                  <span className="viz-package-drift__inline-note muted">
                    oldest in window
                  </span>
                ) : null}
              </div>
              {changes.length > 0 ? (
                <ul className="viz-package-drift__changes">
                  {changes.map((c) => (
                    <li key={c.name} className="viz-package-drift__change">
                      <code className="viz-package-drift__pkg">{shortPackageName(c.name)}</code>
                      <span className="viz-package-drift__from">{c.from ?? "—"}</span>
                      <span className="viz-package-drift__arrow" aria-hidden>
                        →
                      </span>
                      <span className="viz-package-drift__to">{c.to ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function diffPackages(
  cur: PackageMatrixRow,
  prior: PackageMatrixRow | null,
  packages: string[]
): PackageChange[] {
  if (prior == null) return [];
  const changes: PackageChange[] = [];
  for (const pkg of packages) {
    const curV = cur.packages[pkg]?.version ?? null;
    const priorV = prior.packages[pkg]?.version ?? null;
    if (curV === priorV) continue;
    // Skip pure missing-on-both edge case (shouldn't happen at this
    // point but cheap to guard).
    if (curV == null && priorV == null) continue;
    changes.push({ name: pkg, from: priorV, to: curV });
  }
  return changes;
}

function shortPackageName(name: string): string {
  // com.unity.foo.bar → foo.bar
  return name.replace(/^com\.unity\./, "");
}
