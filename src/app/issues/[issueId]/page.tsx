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

export default async function IssuePage({ params }: { params: Promise<{ issueId: string }> }) {
  const { issueId } = await params;
  const id = decodeURIComponent(issueId);
  const results = (await safeIssue(id)) as Mention[];
  const trackerUrl = issueTrackerHref(id);
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
                title="Derived from the latest release-note mention indexed locally — Unity's tracker is the source of truth."
              >
                {issueStatusLabel(status)}
              </span>
            ) : null}
          </div>
        </div>
        <p>
          {results.length === 0
            ? "Not mentioned in indexed release notes yet."
            : `Mentioned in ${results.length} release note${results.length === 1 ? "" : "s"}.`}
        </p>
        {status.kind !== "unknown" ? (
          <p className="muted" style={{ marginTop: 4 }}>{statusDetail(status)}</p>
        ) : null}
        <div className="cluster" style={{ marginTop: 12 }}>
          <ExternalLink href={trackerUrl} className="link-internal--accent">
            Open on Unity Issue Tracker
          </ExternalLink>
        </div>
      </section>

      {results.length === 0 ? null : (
        <div className="table-wrap"><table className="dense-table">
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
                  {row.area ? <div className="muted" style={{ fontSize: 12 }}>{row.area}</div> : null}
                </td>
                <td>
                  <RiskBadge level={row.risk_level} />
                </td>
                <td>
                  <ImpactPill kind={row.impact_kind} />
                </td>
                <td>
                  <span style={{ color: "var(--text-secondary)" }} title={row.body}>
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
