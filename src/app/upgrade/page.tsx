import { filtersFromSearchParams } from "@/lib/api";
import { searchReleaseNotes } from "@/lib/db/repositories";

export const dynamic = "force-dynamic";

export default async function UpgradePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = toUrlSearchParams(await searchParams);
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const platform = params.get("platform") ?? "";
  const risks = await safeRisks(to, platform);

  return (
    <>
      <h1>Upgrade Impact</h1>
      <form className="filters">
        <input name="from" placeholder="Current version or line, e.g. 6000.2" defaultValue={from} />
        <input name="to" placeholder="Target version or line, e.g. 6000.3" defaultValue={to} />
        <input name="platform" placeholder="Platform, e.g. WebGL" defaultValue={platform} />
        <button type="submit">Compare</button>
      </form>
      <section className="panel">
        <h2>Advisory Signal</h2>
        <p>
          {risks.some((item) => item.risk_level === "blocker")
            ? "hold_off"
            : risks.some((item) => item.risk_level === "caution" || item.risk_level === "review")
              ? "worth_reviewing"
              : "likely_safe"}
        </p>
        <p className="muted">This signal is rule-based and explains risks; it is not a guarantee.</p>
      </section>
      <div className="list">
        {risks.map((item) => (
          <article className="item" key={item.id}>
            <strong>
              {item.version} · {item.section} · {item.risk_level}
            </strong>
            <p>{item.body}</p>
          </article>
        ))}
      </div>
    </>
  );
}

async function safeRisks(target: string, platform: string) {
  try {
    return await searchReleaseNotes(
      filtersFromSearchParams(
        new URLSearchParams({
          ...(target ? { minorLine: target } : {}),
          ...(platform ? { platform } : {}),
          limit: "100"
        })
      )
    );
  } catch {
    return [];
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
