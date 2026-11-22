import type { ReactNode } from "react";
import { guideHref, guideStatus, guideSupportLines, type GuideImage, type ReleaseGuide } from "@/lib/release-guides";
import { Chip } from "../_components/Chip";
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
    <a className="guide-release-link" href={guideHref(guide)} aria-label={`Read the Unity ${guide.version} guide`}>
    <h2>Unity {guide.version}{guide.kind === "lts" ? " LTS" : ""}</h2>
    <GuideBadges guide={guide} now={now} />
    <div className="guide-card-support">{guideSupportLines(guide, now).map(line => <span key={line}>{line}</span>)}</div>
    <div className="guide-feature-image"><img src={guide.highlights[0].image.src} alt={guide.highlights[0].image.alt} width={guide.highlights[0].image.width} height={guide.highlights[0].image.height} loading={eager ? "eager" : "lazy"} decoding="async" /></div>
    <p className="guide-card-summary">{guide.summary}</p>
    <span className="guide-read" aria-hidden="true">View features →</span>
    </a>
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

export function GuideHighlightCard({
  href, headingId, title, summary, image, beforeTitle, action, children, eager = false, headingLevel = 2
}: {
  href: string;
  headingId: string;
  title: string;
  summary: string;
  image?: GuideImage;
  beforeTitle?: ReactNode;
  action: string;
  children: ReactNode;
  eager?: boolean;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return <article className="guide-highlight">
    <a className="guide-feature-link" href={href} aria-labelledby={headingId}>
      {image && <div className="guide-feature-image"><img src={image.src} alt={image.alt} width={image.width} height={image.height} loading={eager ? "eager" : "lazy"} decoding="async" /></div>}
      <div className="guide-highlight-copy">
        {beforeTitle}
        <Heading className="guide-feature-title" id={headingId}>{title}</Heading>
        <p>{summary}</p>
        <div className="guide-feature-footer">
          {children}
          <span className="guide-feature-action" aria-hidden="true">{action} <span>→</span></span>
        </div>
      </div>
    </a>
  </article>;
}

export function FeatureCard({ guide, feature, eager = false, showVersion = false, headingLevel = 2 }: {
  guide: ReleaseGuide;
  feature: ReleaseFeature;
  eager?: boolean;
  showVersion?: boolean;
  headingLevel?: 2 | 3;
}) {
  const preview = /\b(beta|experimental)\b/i.test(feature.limitation ?? "");
  return <GuideHighlightCard href={featureHref(guide, feature)} headingId={`feature-${feature.id}`}
    title={feature.title} summary={feature.benefit} image={feature.image} action="Explore feature"
    eager={eager} headingLevel={headingLevel}
    beforeTitle={showVersion && <p className="feature-catalog-version">Unity {guide.version} highlight</p>}>
    <Chip className="chip--area">{feature.category}</Chip>
    {preview && <span className="guide-badge">Preview at launch</span>}
  </GuideHighlightCard>;
}
