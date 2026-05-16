import type { VersionFact } from "@/lib/visualizer";

export function Top10FactsPanel({ facts }: { facts: VersionFact[] }) {
  if (facts.length === 0) {
    return (
      <aside className="viz-facts">
        <h2 className="viz-facts__title">Top 10 version facts</h2>
        <p className="muted">Not enough data yet — re-run ingestion.</p>
      </aside>
    );
  }
  return (
    <aside className="viz-facts" aria-label="Top 10 version facts">
      <h2 className="viz-facts__title">Top 10 version facts</h2>
      <ol className="viz-facts__list">
        {facts.map((fact) => (
          <li key={fact.id} className="viz-facts__item">
            <div className="viz-facts__label">{fact.label}</div>
            <div className="viz-facts__value">
              {fact.href ? (
                <a href={fact.href}>{fact.value}</a>
              ) : (
                fact.value
              )}
            </div>
            <div className="viz-facts__formula" title={fact.formula}>
              {fact.formula}
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
