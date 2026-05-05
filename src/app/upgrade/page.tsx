import { filtersFromSearchParams } from "@/lib/api";
import { listReleaseNoteFacets, searchReleaseNotes } from "@/lib/db/repositories";
import { cleanReleaseNoteText } from "@/lib/release-notes/format";

export const dynamic = "force-dynamic";

type UpgradeItem = {
  id?: number;
  version: string;
  section: string;
  area?: string | null;
  platforms?: string[];
  package_names?: string[];
  impact_kind?: string;
  risk_level?: string;
  body: string;
  issue_ids?: string[];
};

export default async function UpgradePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = toUrlSearchParams(await searchParams);
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const platform = params.get("platform") ?? "";
  const [items, facets] = await Promise.all([safeRisks(to, platform), safeFacets()]);
  const lanes = buildUpgradeLanes(items);
  const activeBlockers = lanes.activeKnownIssues.filter((item) => item.risk_level === "blocker").length;
  const advisory = activeBlockers
    ? "Hold off until reviewed"
    : lanes.activeKnownIssues.length || lanes.apiAndBreaking.length || lanes.platformAndInstall.length
      ? "Worth reviewing"
      : "Likely safe";

  return (
    <div className="workbench">
      <section className="page-header">
        <div>
          <h1>Upgrade Review</h1>
          <p className="muted">
            Review what matters when moving from your current Unity line to a target Unity 6 release or stream.
          </p>
        </div>
      </section>

      <form className="filters labeled-filters">
        <label className="field">
          <span>Current version or line</span>
          <input name="from" placeholder="6000.3 or 6000.3.14f1" defaultValue={from} />
        </label>
        <label className="field">
          <span>Target version or line</span>
          <input name="to" placeholder="6000.5 or 6000.5.0b6" defaultValue={to} />
        </label>
        <label className="field">
          <span>Platform</span>
          <select name="platform" defaultValue={platform}>
            <option value="">All platforms</option>
            {facets.platforms.map((value) => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Review upgrade</button>
      </form>

      <section className="panel advisory-panel">
        <div>
          <h2>{advisory}</h2>
          <p className="muted">
            {from || "Current project"} → {to || "target Unity line"} {platform ? `for ${platform}` : ""}
          </p>
        </div>
        <div className="stat-strip">
          <span>
            <strong>{activeBlockers}</strong>
            active blockers
          </span>
          <span>
            <strong>{lanes.activeKnownIssues.length}</strong>
            known issues
          </span>
          <span>
            <strong>{lanes.fixesGained.length}</strong>
            fixes gained
          </span>
        </div>
      </section>

      <div className="upgrade-lanes">
        {upgradeLane("Active Known Issues", lanes.activeKnownIssues)}
        {upgradeLane("Fixes Gained", lanes.fixesGained)}
        {upgradeLane("API / Breaking Changes", lanes.apiAndBreaking)}
        {upgradeLane("Package Changes", lanes.packageChanges)}
        {upgradeLane("Platform / Install Impact", lanes.platformAndInstall)}
        {upgradeLane("Other Notes", lanes.other)}
      </div>
    </div>
  );
}

async function safeRisks(target: string, platform: string) {
  try {
    const exactVersion = /^\d{4}\.\d+\.\d+[abf]\d+$/i.test(target);
    return (await searchReleaseNotes(
      filtersFromSearchParams(
        new URLSearchParams({
          ...(target && exactVersion ? { version: target } : {}),
          ...(target && !exactVersion ? { minorLine: target } : {}),
          ...(platform ? { platform } : {}),
          limit: "150"
        })
      )
    )) as UpgradeItem[];
  } catch {
    return [];
  }
}

async function safeFacets() {
  try {
    return await listReleaseNoteFacets();
  } catch {
    return { platforms: [] };
  }
}

function toUrlSearchParams(input: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value) {
      params.set(key, value);
    }
  }
  return params;
}

function buildUpgradeLanes(items: UpgradeItem[]) {
  const lanes = {
    activeKnownIssues: [] as UpgradeItem[],
    fixesGained: [] as UpgradeItem[],
    apiAndBreaking: [] as UpgradeItem[],
    packageChanges: [] as UpgradeItem[],
    platformAndInstall: [] as UpgradeItem[],
    other: [] as UpgradeItem[]
  };

  for (const item of items) {
    switch (item.impact_kind) {
      case "known_issue":
      case "upgrade_blocker":
        lanes.activeKnownIssues.push(item);
        break;
      case "fix":
      case "security_related_fix":
        lanes.fixesGained.push(item);
        break;
      case "api_change":
      case "breaking_change":
        lanes.apiAndBreaking.push(item);
        break;
      case "package_change":
        lanes.packageChanges.push(item);
        break;
      case "platform_risk":
      case "install_risk":
        lanes.platformAndInstall.push(item);
        break;
      default:
        lanes.other.push(item);
        break;
    }
  }

  return lanes;
}

function upgradeLane(title: string, items: UpgradeItem[]) {
  return (
    <section className="panel">
      <header className="lane-header">
        <h2>{title}</h2>
        <span className="chip">{items.length}</span>
      </header>
      {items.length ? (
        <div className="list compact-list">
          {items.slice(0, 20).map((item) => (
            <article className="note-row" key={item.id}>
              <div className="note-row-top">
                <span className={`badge risk-${item.risk_level ?? "info"}`}>{riskLabel(item.risk_level)}</span>
                <strong>{item.version}</strong>
                <span className="muted">{item.area ?? item.section}</span>
              </div>
              <p>{cleanReleaseNoteText(item.body)}</p>
              <div className="note-meta">
                {(item.platforms ?? []).map((value) => (
                  <span className="chip" key={value}>
                    {value}
                  </span>
                ))}
                {(item.issue_ids ?? []).map((value) => (
                  <a className="chip link-chip" href={`/issues/${encodeURIComponent(value)}`} key={value}>
                    {value}
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">No indexed notes in this lane for the selected target.</p>
      )}
    </section>
  );
}

function riskLabel(value?: string | null) {
  const labels: Record<string, string> = {
    blocker: "Blocker",
    caution: "Caution",
    review: "Review",
    info: "Info"
  };
  return labels[value ?? ""] ?? "Info";
}
