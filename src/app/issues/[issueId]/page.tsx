import { searchReleaseNotes } from "@/lib/db/repositories";
import { ImpactPill } from "../../_components/ImpactPill";
import { RiskBadge } from "../../_components/RiskBadge";
import { ExternalLink } from "../../_components/ExternalLink";
import { issueTrackerHref } from "../../_components/IssuePill";
import { cleanReleaseNoteText } from "@/lib/release-notes/format";

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

  return (
    <>
      <section className="page-header">
        <div className="page-header__title-row">
          <h1 className="tabnums">{id}</h1>
        </div>
        <p>
          {results.length === 0
            ? "Not mentioned in indexed release notes yet."
            : `Mentioned in ${results.length} release note${results.length === 1 ? "" : "s"}.`}
        </p>
        <div className="cluster" style={{ marginTop: 12 }}>
          <ExternalLink href={trackerUrl} className="link-internal--accent">
            Open on Unity Issue Tracker
          </ExternalLink>
        </div>
      </section>

      {results.length === 0 ? null : (
        <table className="dense-table">
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
        </table>
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
