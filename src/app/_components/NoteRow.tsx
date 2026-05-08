import { cleanReleaseNoteText, normalizeIssueLinks } from "@/lib/release-notes/format";
import type { IssueStatus } from "@/lib/issue-status";
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
  /**
   * Map of issue id → derived status. Pages batch-fetch these so each
   * IssuePill can render a fixed/open/regressed dot inline.
   */
  issueStatuses?: Map<string, IssueStatus> | null;
};

export function NoteRow({ row, showImpactPill = false, issueStatuses }: Props) {
  const cleanedBody = cleanReleaseNoteText(row.body ?? "");
  const issueLinks = normalizeIssueLinks(row.issue_ids ?? [], row.issue_links_json);
  const ariaLabel = row.version
    ? `${row.section} note in ${row.version}`
    : `${row.section} note`;
  // Unity occasionally fills `area` with a literal package id like
  // `com.unity.sentis`. The package chip already renders that, so the
  // area chip would just duplicate it — fall back to the section label
  // when area looks like a package id.
  const rawArea = row.area;
  const areaLabel =
    rawArea && !looksLikePackageId(rawArea) ? rawArea : row.section;
  // Drop platforms that match the area OR any package name on this row
  // (case-insensitive). Unity routinely lists "XR" / "Android" / "iOS"
  // and even full package ids in both columns, which would otherwise
  // produce identical-looking chips back-to-back.
  const seen = new Set<string>();
  if (areaLabel) seen.add(areaLabel.toLowerCase());
  for (const p of row.package_names ?? []) seen.add(p.toLowerCase());
  const platforms = (row.platforms ?? []).filter(
    (plat) => !seen.has(plat.toLowerCase())
  );

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
          {platforms.slice(0, 4).map((plat) => (
            <PlatformPill platform={plat} key={plat} />
          ))}
          {issueLinks.slice(0, 3).map((issue) => (
            <IssuePill
              id={issue.id}
              url={issue.url}
              status={issueStatuses?.get(issue.id) ?? null}
              key={issue.id}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

function looksLikePackageId(value: string): boolean {
  return /^com\.unity\./i.test(value);
}
