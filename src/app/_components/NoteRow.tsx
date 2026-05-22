import { Fragment } from "react";
import {
  cleanReleaseNoteText,
  normalizeIssueLinks,
  parseAreaVersionList,
  tokenizeReleaseNoteBody
} from "@/lib/release-notes/format";
import { parseUnityVersion } from "@/lib/parsers/version";
import type { IssueStatus } from "@/lib/issue-status";
import { ImpactPill } from "./ImpactPill";
import { RiskBadge } from "./RiskBadge";
import { PackagePill } from "./PackagePill";
import { PlatformPill } from "./PlatformPill";
import { IssuePill } from "./IssuePill";
import { VersionPill } from "./VersionPill";

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
   * Surfaces where the lane header already names the row's section
   * (e.g. /releases/[version] has a "Packages updated" lane title)
   * should pass `true` so NoteRow skips the area chip's section
   * fallback. Without this, package_change rows render an area chip
   * that just echoes the lane header. Surfaces that group by something
   * other than section — /explorer groups by version — leave it false
   * so the section still surfaces as a chip.
   */
  laneShowsSection?: boolean;
  /**
   * Map of issue id → derived status. Pages batch-fetch these so each
   * IssuePill can render a fixed/open/regressed dot inline.
   */
  issueStatuses?: Map<string, IssueStatus> | null;
};

export function NoteRow({
  row,
  showImpactPill = false,
  laneShowsSection = false,
  issueStatuses
}: Props) {
  const cleanedBody = cleanReleaseNoteText(row.body ?? "");
  const bodyTokens = tokenizeReleaseNoteBody(cleanedBody);
  const issueLinks = normalizeIssueLinks(row.issue_ids ?? [], row.issue_links_json);
  const ariaLabel = row.version
    ? `${row.section} note in ${row.version}`
    : `${row.section} note`;
  // Unity occasionally fills `area` with a literal package id like
  // `com.unity.sentis`. The package chip already renders that, so the
  // area chip would just duplicate it - fall back to the section label
  // when area looks like a package id.
  const rawArea = row.area;
  // Detect Unity's "area is actually a backport target list" overload
  // (e.g. area = "6000.6.0a2,6000.4.4f1,6000.5.0b5"). When matched, the
  // row renders each version as its own VersionPill instead of a single
  // unparsable area chip — see ~150 rows in prod that hit this case.
  const backportVersions = parseAreaVersionList(rawArea);
  // The area chip falls back to the section name only when the lane
  // doesn't already display it (e.g. /explorer where the lane shows the
  // version). Otherwise we'd render a redundant "Packages updated" chip
  // on every package_change row inside a "Packages updated" lane.
  const usableArea =
    rawArea && !backportVersions && !looksLikePackageId(rawArea) ? rawArea : null;
  const areaLabel = usableArea ?? (laneShowsSection ? null : row.section);
  // If area looks like a package id but the package_names extractor
  // missed it (happens for third-party bundled packages like
  // com.havok.physics and com.autodesk.fbx), promote the area into
  // package_names so the PackagePill renders and the impact-pill
  // dedup logic below treats the row consistently.
  const effectivePackageNames =
    rawArea &&
    looksLikePackageId(rawArea) &&
    !(row.package_names ?? []).some((p) => p.toLowerCase() === rawArea.toLowerCase())
      ? [rawArea, ...(row.package_names ?? [])]
      : row.package_names ?? [];
  // Drop the impact pill on package_change rows that already render a
  // PackagePill — the package id implicitly says "this is a package
  // update", so the explicit "Package" chip just duplicates the signal.
  const hasPackagePill = effectivePackageNames.length > 0;
  const renderImpactPill =
    showImpactPill && !(row.impact_kind === "package_change" && hasPackagePill);
  // Drop platforms that match the area OR any package name on this row
  // (case-insensitive). Unity routinely lists "XR" / "Android" / "iOS"
  // and even full package ids in both columns, which would otherwise
  // produce identical-looking chips back-to-back.
  const seen = new Set<string>();
  if (areaLabel) seen.add(areaLabel.toLowerCase());
  for (const p of effectivePackageNames) seen.add(p.toLowerCase());
  const platforms = (row.platforms ?? []).filter(
    (plat) => !seen.has(plat.toLowerCase())
  );

  return (
    <article className="row" aria-label={ariaLabel}>
      <div className="row__body">
        <div className="row__title row__title--wrap" title={cleanedBody}>
          {bodyTokens.map((tok, idx) =>
            tok.kind === "version" ? (
              <VersionPill
                key={`v-${idx}`}
                version={tok.version}
                stream={safeStreamForInline(tok.version)}
                compact
              />
            ) : (
              <Fragment key={`t-${idx}`}>{tok.value}</Fragment>
            )
          )}
        </div>
        <div className="row__pills">
          {backportVersions ? (
            <span
              className="row__backport-versions"
              aria-label="Backported to versions"
              title="Backported to these Unity versions"
            >
              {backportVersions.map((v) => (
                <VersionPill
                  key={`bp-${v}`}
                  version={v}
                  stream={safeStreamForInline(v)}
                  compact
                />
              ))}
            </span>
          ) : areaLabel ? (
            <span className="chip chip--area">{areaLabel}</span>
          ) : null}
          {renderImpactPill ? <ImpactPill kind={row.impact_kind} /> : null}
          <RiskBadge level={row.risk_level} />
          {effectivePackageNames.slice(0, 2).map((pkg) => (
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
  // Reverse-DNS package format: `com.unity.*`, third-party bundled
  // packages like `com.havok.physics` and `com.autodesk.fbx`, and
  // two-segment forms Unity uses for NuGet bundles like `nuget.moq`
  // and `nuget.castle-core`.
  //
  // Two or more dot-separated all-lowercase segments. Leading char
  // must be a letter so we don't match versions like "1.2.3" or
  // "6000.3.15f1". Strict-lowercase (no /i flag) so TitleCase subsystem
  // names with dots — `My.Company`, hypothetical `Build.Pipeline` —
  // don't get swallowed; every package id Unity ships is lowercase.
  return /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/.test(value);
}

/** Resolve the Unity stream for an inline version mention so the
 *  compact VersionPill can hint at LTS / beta / alpha via its hover
 *  title. Swallows parse errors because release-note bodies sometimes
 *  contain version-shaped strings that don't fully validate. */
function safeStreamForInline(version: string): string | null {
  try {
    return parseUnityVersion(version).stream;
  } catch {
    return null;
  }
}
