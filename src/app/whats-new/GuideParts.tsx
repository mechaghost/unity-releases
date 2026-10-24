import { guideHref, guideStatus, SUPPORT_SOURCE, type GuideImage, type ReleaseGuide } from "@/lib/release-guides";
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
    <FeatureImage image={guide.highlights[0].image} />
    <GuideBadges guide={guide} now={now} />
    <h3><a href={guideHref(guide)}>Unity {guide.version}{guide.kind === "lts" ? " LTS" : ""}</a></h3>
    <p className="guide-card-summary">{guide.summary}</p>

    <p className="guide-caption">Released <time dateTime={guide.released}>{formatGuideDate(guide.released)}</time></p>
    <a className="guide-read" href={guideHref(guide)}>Read the Unity {guide.version} guide <span aria-hidden="true">→</span></a>
  </article>;
}

export function FeatureImage({ image, eager = false }: { image: GuideImage; eager?: boolean }) {
  return <figure className="guide-figure">
    <a className="guide-image-link" href={image.src} target="_blank" rel="noopener noreferrer" aria-label={`Enlarge image: ${image.alt}`}>
      {/* Local, pre-sized WebP assets keep layout stable without remote image requests. */}
      <img src={image.src} alt={image.alt} width={image.width} height={image.height} loading={eager ? "eager" : "lazy"} decoding="async" />
    </a>
    <figcaption><ExternalLink href={image.source}>Image: Unity · View source</ExternalLink></figcaption>
  </figure>;
}

export function SupportExplainer() {
  return <section className="guide-support" aria-labelledby="guide-support-title" id="support">
    <h2 id="guide-support-title">LTS or Supported Update?</h2>
    <div className="guide-support-columns">
      <div><h3>LTS</h3><p>Stay on one version longer. Generally two years of fixes, plus an extra year for Enterprise and Industry.</p></div>
      <div><h3>Supported Update</h3><p>Get newer features sooner. Supported until the next release replaces it.</p></div>
    </div>
    <ExternalLink href={SUPPORT_SOURCE}>Check Unity’s support policy</ExternalLink>
  </section>;
}
