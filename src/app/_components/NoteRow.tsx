import { cleanReleaseNoteText, normalizeIssueLinks } from "@/lib/release-notes/format";
import { ImpactPill } from "./ImpactPill";
import { RiskBadge } from "./RiskBadge";
import { PackagePill } from "./PackagePill";
import { PlatformPill } from "./PlatformPill";
import { IssuePill } from "./IssuePill";

/**
 * Minimal shape any release-note row must satisfy to render through
 * <NoteRow />. Both the diff view (compare) and the per-release view
 * project their DB rows onto this so the row markup, pill set, and
 * truncation rules live in one place.
 */
export type NoteRowData = {
  id: number;
  version?: string;
  section: string;
  area: string | null;
  body: string;
  impact_kind: string;
  risk_level: string;
  platforms: string[];
  package_names: string[];
  issue_ids: string[];
  issue_links_json: unknown;
};

type Props = {
  row: NoteRowData;
  /**
   * Whether to render the impact pill in the row body. Compare hides it
   * because the lane header already shows the impact for the whole lane;
   * the per-release view shows it because rows can mix impacts within a
   * single lane (e.g. "known issues" includes blocker + non-blocker).
   */
  showImpactPill?: boolean;
};

export function NoteRow({ row, showImpactPill = false }: Props) {
  const cleanedBody = cleanReleaseNoteText(row.body ?? "");
  const issueLinks = normalizeIssueLinks(row.issue_ids ?? [], row.issue_links_json);
  const ariaLabel = row.version
    ? `${row.section} note in ${row.version}`
    : `${row.section} note`;
  const areaLabel = row.area || row.section;

  return (
    <article className="row" aria-label={ariaLabel}>
      <div className="row__body">
        <div className="row__title row__title--wrap" title={cleanedBody}>
          {cleanedBody}
        </div>
        <div className="row__pills">
          {areaLabel ? <span className="chip chip--area">{areaLabel}</span> : null}
          {showImpactPill ? <ImpactPill kind={row.impact_kind} /> : null}
          <RiskBadge level={row.risk_level} />
          {(row.package_names ?? []).slice(0, 2).map((pkg) => (
            <PackagePill name={pkg} key={pkg} />
          ))}
          {(row.platforms ?? []).slice(0, 4).map((plat) => (
            <PlatformPill platform={plat} key={plat} />
          ))}
          {issueLinks.slice(0, 3).map((issue) => (
            <IssuePill id={issue.id} url={issue.url} key={issue.id} />
          ))}
        </div>
      </div>
    </article>
  );
}
