import type { IngestionFreshness } from "@/lib/db/repositories";

/**
 * "Last ingested" footer. Personas were unanimous that they will not
 * trust numbers on a dashboard without a visible data-freshness signal,
 * so every visualizer page anchors with this rail.
 */
export function TrustRail({ freshness }: { freshness: IngestionFreshness[] }) {
  const editor = freshness.find((f) => f.sourceType === "editor_release");
  const packages = freshness.find((f) => f.sourceType === "package_version");

  return (
    <footer className="viz-trust-rail">
      <div className="viz-trust-rail__title">Where the numbers come from</div>
      <ul className="viz-trust-rail__list">
        <li>
          Editor releases ingested {formatLastSuccess(editor)} · package versions ingested {formatLastSuccess(packages)}.
        </li>
        <li>
          Net-fix = <code>fixes − known_issues</code> per release. No
          weighting, no synthetic 0–100 scores.
        </li>
        <li>
          Issue lifespan = first <code>Known Issues</code> mention →
          first <code>Fixes</code> mention, joined on UUM-id.
        </li>
        <li>
          Domain bucketing groups free-text <code>area</code> labels via
          fixed regex rules; unmatched falls into <code>Other</code>.
        </li>
        <li>
          Every chart links into the underlying release-note rows — if a
          number looks wrong, click through to audit it.
        </li>
      </ul>
    </footer>
  );
}

function formatLastSuccess(f: IngestionFreshness | undefined): string {
  if (!f || f.lastSuccessAt == null) return "never";
  const hours = f.hoursSinceLastSuccess;
  if (hours < 1) return "<1h ago";
  if (hours < 36) return `${Math.floor(hours)}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
