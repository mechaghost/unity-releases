import { searchReleaseNotes } from "@/lib/db/repositories";
import { ImpactPill } from "../../_components/ImpactPill";
import { RiskBadge } from "../../_components/RiskBadge";
import { ExternalLink } from "../../_components/ExternalLink";
import { issueTrackerHref } from "../../_components/IssuePill";
import { cleanReleaseNoteText } from "@/lib/release-notes/format";
import {
  deriveIssueStatus,
  issueStatusLabel,
  issueStatusTone,
  type IssueStatus
} from "@/lib/issue-status";
import { formatReleaseDate } from "@/lib/format-date";

export const dynamic = "force-dynamic";

type Mention = {
  id: number;
  version: string;
  section: string;
  area: string | null;
  body: string;
  impact_kind: string;
  risk_level: string;
  release_date: string | null;
};

export default async function IssuePage({
  params,
  searchParams
}: {
  params: Promise<{ issueId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { issueId } = await params;
  const id = decodeURIComponent(issueId);
  const allResults = (await safeIssue(id)) as Mention[];
  const trackerUrl = issueTrackerHref(id);
  const sp = (await searchParams) ?? {};
  const requestedMajor = parseMajorParam(sp.major);
  // Available scope chips are the majors this issue actually has mentions in.
  // The default scope is "all" (mirrors the prior behaviour) — picking a chip
  // re-derives the status, which is what fixes the "fixed in 6000.3.0b1" badge
  // showing up for a user still on 2019/2020/2021/2022 LTS where Unity has
  // not backported the fix. Same idea as the relevantMajors filter on
  // /compare's issueStatus map, just exposed as a chip row here.
  const availableMajors = uniqueSorted(
    allResults
      .map((r) => majorOf(r.version))
      .filter((n): n is number => n !== null)
  );
  const activeMajor =
    requestedMajor !== null && availableMajors.includes(requestedMajor)
      ? requestedMajor
      : null;
  const results = activeMajor === null
    ? allResults
    : allResults.filter((r) => majorOf(r.version) === activeMajor);
  const status = deriveIssueStatus(results);

  return (
    <>
      <section className="page-header">
        <div className="page-header__title-row">
          <div className="cluster" style={{ alignItems: "center", gap: 12 }}>
            <h1 className="tabnums">{id}</h1>
            {status.kind !== "unknown" ? (
              <span
                className={`chip chip--status-${issueStatusTone(status)}`}
                title="Derived from the latest release-note mention indexed locally - Unity's tracker is the source of truth."
              >
                {issueStatusLabel(status)}
              </span>
            ) : null}
          </div>
        </div>
        <p>
          {results.length === 0
            ? activeMajor === null
              ? "Not mentioned in indexed release notes yet."
              : `Not mentioned in any indexed ${majorLabel(activeMajor)} release.`
            : activeMajor === null
              ? `Mentioned in ${results.length} release note${results.length === 1 ? "" : "s"}.`
              : `Mentioned in ${results.length} ${majorLabel(activeMajor)} release note${results.length === 1 ? "" : "s"}.`}
        </p>
        {status.kind !== "unknown" ? (
          <p className="muted text-xs">{statusDetail(status)}</p>
        ) : null}
        {availableMajors.length > 1 ? (
          <div
            className="stream-checkbox-filter"
            role="group"
            aria-label="Scope by Unity major"
            style={{ marginTop: 12 }}
          >
            <a
              href={`/issues/${encodeURIComponent(id)}`}
              className={`stream-checkbox-filter__option${activeMajor === null ? " stream-checkbox-filter__option--checked" : ""}`}
            >
              All ({allResults.length})
            </a>
            {availableMajors.map((m) => {
              const count = allResults.filter((r) => majorOf(r.version) === m).length;
              return (
                <a
                  key={m}
                  href={`/issues/${encodeURIComponent(id)}?major=${m}`}
                  className={`stream-checkbox-filter__option${activeMajor === m ? " stream-checkbox-filter__option--checked" : ""}`}
                >
                  {majorLabel(m)} ({count})
                </a>
              );
            })}
          </div>
        ) : null}
        <div className="cluster page-meta-row">
          <ExternalLink href={trackerUrl} className="link-internal--accent">
            Open on Unity Issue Tracker
          </ExternalLink>
        </div>
      </section>

      {results.length === 0 ? null : (
        <div className="table-surface"><table className="dense-table">
          <thead>
            <tr>
              <th style={{ width: 140 }}>Version</th>
              <th style={{ width: 140 }}>Section</th>
              <th style={{ width: 100 }}>Risk</th>
              <th style={{ width: 130 }}>Impact</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row) => (
              <tr key={row.id}>
                <td>
                  <a className="link-internal--accent tabnums" href={`/releases/${encodeURIComponent(row.version)}`}>
                    {row.version}
                  </a>
                </td>
                <td>
                  <span className="muted">{row.section}</span>
                  {row.area ? <div className="muted text-xs">{row.area}</div> : null}
                </td>
                <td>
                  <RiskBadge level={row.risk_level} />
                </td>
                <td>
                  <ImpactPill kind={row.impact_kind} />
                </td>
                <td>
                  <span className="text-secondary" title={row.body}>
                    {cleanReleaseNoteText(row.body)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </>
  );
}

async function safeIssue(issueId: string) {
  try {
    return await searchReleaseNotes({ issueId });
  } catch {
    return [];
  }
}

function majorOf(version: string): number | null {
  const dot = version.indexOf(".");
  if (dot < 0) return null;
  const n = Number(version.slice(0, dot));
  return Number.isFinite(n) ? n : null;
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => b - a);
}

function majorLabel(major: number): string {
  return major === 6000 ? "Unity 6" : `Unity ${major} LTS`;
}

function parseMajorParam(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function statusDetail(status: IssueStatus): string {
  switch (status.kind) {
    case "resolved": {
      const date = status.releaseDate ? ` (${formatReleaseDate(status.releaseDate)})` : "";
      const extra =
        status.additionalFixCount > 0
          ? `; relisted in ${status.additionalFixCount} later release${status.additionalFixCount === 1 ? "" : "s"}`
          : "";
      return `First fixed in ${status.version}${date}${extra}.`;
    }
    case "regressed": {
      const knownDate = status.knownReleaseDate ? ` (${formatReleaseDate(status.knownReleaseDate)})` : "";
      const fixDate = status.lastFixedReleaseDate ? ` (${formatReleaseDate(status.lastFixedReleaseDate)})` : "";
      return `Listed as a known issue in ${status.knownVersion}${knownDate} after a fix shipped in ${status.lastFixedVersion}${fixDate}.`;
    }
    case "open": {
      const date = status.releaseDate ? ` (${formatReleaseDate(status.releaseDate)})` : "";
      return `Listed as a known issue in ${status.version}${date}; no fix in indexed releases yet.`;
    }
    case "mentioned": {
      const date = status.releaseDate ? ` (${formatReleaseDate(status.releaseDate)})` : "";
      return `Latest mention is in ${status.version} under "${status.section}"${date}.`;
    }
    case "unknown":
      return "";
  }
}
