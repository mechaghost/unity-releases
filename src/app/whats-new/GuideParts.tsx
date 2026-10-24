import { guideHref, guideStatus, SUPPORT_SOURCE, type GuideImage, type ReleaseGuide } from "@/lib/release-guides";
import { ExternalLink } from "../_components/ExternalLink";
import { featureHref, type ReleaseFeature } from "@/lib/release-features";

export function GuideBadges({ guide, now }: { guide: ReleaseGuide; now: Date }) {
  const status = guideStatus(guide, now);
  return <div className="guide-badges" aria-label="Release type and support status">
    <span className="guide-badge">{guide.kind === "lts" ? "LTS · Long-term support" : "Update release"}</span>
    <span className={`guide-badge ${status.active ? "guide-badge--active" : "guide-badge--quiet"}`}>{status.label}</span>
  </div>;
}

export function GuideCard({ guide, now, eager = false }: { guide: ReleaseGuide; now: Date; eager?: boolean }) {
  return <article className="guide-card">
    <h2><a href={guideHref(guide)}>Unity {guide.version}{guide.kind === "lts" ? " LTS" : ""}</a></h2>
    <GuideBadges guide={guide} now={now} />
    <FeatureImage image={guide.highlights[0].image} eager={eager} guide={guide} />
    <p className="guide-card-summary">{guide.summary}</p>
    <a className="guide-read" href={guideHref(guide)} aria-label={`Read the Unity ${guide.version} guide`}>View features <span aria-hidden="true">→</span></a>
  </article>;
}

export function FeatureImage({ image, eager = false, guide }: { image: GuideImage; eager?: boolean; guide?: ReleaseGuide }) {
  return <figure className="guide-figure">
    <a className="guide-image-link" href={guide ? guideHref(guide) : image.src} aria-label={guide ? `View Unity ${guide.version} features` : `Enlarge image: ${image.alt}`}>
      {/* Local, pre-sized WebP assets keep layout stable without remote image requests. */}
      <img src={image.src} alt={image.alt} width={image.width} height={image.height} loading={eager ? "eager" : "lazy"} decoding="async" />
    </a>
  </figure>;
}

export function FeatureCard({ guide, feature, eager = false }: { guide: ReleaseGuide; feature: ReleaseFeature; eager?: boolean }) {
  const headingId = `feature-${feature.id}`;
  const preview = /\b(beta|experimental)\b/i.test(feature.limitation ?? "");
  return <article className="guide-highlight">
    <a className="guide-feature-link" href={featureHref(guide, feature)} aria-labelledby={headingId}>
      <div className="guide-feature-image"><img src={feature.image.src} alt={feature.image.alt} width={feature.image.width} height={feature.image.height} loading={eager ? "eager" : "lazy"} decoding="async" /></div>
      <div className="guide-highlight-copy">
        <h2 id={headingId}>{feature.title}</h2>
        <p>{feature.benefit}</p>
        <div className="guide-feature-footer">{preview && <span className="guide-badge">Preview at launch</span>}<span className="guide-feature-action" aria-hidden="true">Explore feature <span>→</span></span></div>
      </div>
    </a>
  </article>;
}

export function SupportExplainer() {
  return <details className="guide-support" id="support">
    <summary>LTS and support explained</summary>
    <p><strong>LTS:</strong> Generally two years of fixes, plus an extra year for Enterprise and Industry.</p>
    <p><strong>Update:</strong> Supported until the next release replaces it. Superseded releases are no longer supported.</p>
    <ExternalLink href={SUPPORT_SOURCE}>Unity’s support policy</ExternalLink>
  </details>;
}
