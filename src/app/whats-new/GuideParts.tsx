import { guideHref, guideStatus, SUPPORT_SOURCE, type ReleaseGuide } from "@/lib/release-guides";
import { formatGuideDate } from "@/lib/release-guides";
import { ExternalLink } from "../_components/ExternalLink";

export function GuideBadges({ guide, now }: { guide: ReleaseGuide; now: Date }) {
  const status = guideStatus(guide, now);
  return <div className="guide-badges" aria-label="Release type and support status">
    <span className="guide-badge">{guide.kind === "lts" ? "LTS · Long-term support" : "Update release"}</span>
    <span className={`guide-badge ${status.active ? "guide-badge--active" : "guide-badge--quiet"}`}>{status.label}</span>
  </div>;
}

export function GuideCard({ guide, now, featured = false }: { guide: ReleaseGuide; now: Date; featured?: boolean }) {
  return <article className={`guide-card ${featured ? "guide-card--featured" : ""}`}>
    <GuideBadges guide={guide} now={now} />
    <h3><a href={guideHref(guide)}>Unity {guide.version}{guide.kind === "lts" ? " LTS" : ""}</a></h3>
    <p className="guide-card-summary">{guide.summary}</p>
    <ul>{guide.highlights.slice(0, 3).map(item => <li key={item.title}>{item.title}</li>)}</ul>
    <p className="guide-caption">Released <time dateTime={guide.released}>{formatGuideDate(guide.released)}</time></p>
    <a className="guide-read" href={guideHref(guide)}>Read the Unity {guide.version} guide <span aria-hidden="true">→</span></a>
  </article>;
}

export function SupportExplainer() {
  return <section className="guide-support" aria-labelledby="guide-support-title" id="support">
    <div className="guide-section-heading"><span className="guide-eyebrow">Understand the labels</span>
      <h2 id="guide-support-title">LTS or Supported Update?</h2>
      <p>Both are production-ready. The main difference is how long a release is maintained.</p>
    </div>
    <div className="guide-support-columns">
      <div><h3>LTS: a longer maintenance window</h3>
        <p>Generally two years of fixes, with an additional year for Enterprise and Industry subscribers. Useful when your team wants to stay on one version.</p></div>
      <div><h3>Supported Update: a shorter release cycle</h3>
        <p>New capabilities with the same level of support while current. Support lasts until the next release replaces it, so plan for more frequent upgrades.</p></div>
    </div>
    <p><strong>Release type stays the same. Support status changes.</strong> An old Update release is shown as “Superseded,” not “Supported now.” LTS can also reach the end of standard support.</p>
    <ExternalLink href={SUPPORT_SOURCE}>Read Unity’s support policy</ExternalLink>
  </section>;
}
