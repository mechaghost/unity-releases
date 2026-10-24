import { notFound } from "next/navigation";
import { findReleaseGuide, guideHref, guideNotesHref, guideStatus, RELEASE_GUIDES, SUPPORT_SOURCE } from "@/lib/release-guides";
import { pageSocialMetadata } from "@/lib/site";
import { formatGuideDate } from "@/lib/release-guides";
import { ExternalLink } from "../../_components/ExternalLink";
import { GuideBadges, FeatureCard } from "../GuideParts";
import { guideFeatures } from "@/lib/release-features";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const guide = findReleaseGuide((await params).slug);
  if (!guide) return { title: "Guide not found" };
  const title = `What’s new in Unity ${guide.version}${guide.kind === "lts" ? " LTS" : ""}`;
  return { title, description: guide.summary, alternates: { canonical: guideHref(guide) },
    ...pageSocialMetadata({ title, description: guide.summary, path: guideHref(guide) }) };
}
export default async function ReleaseGuidePage({ params }: Props) {
  const guide = findReleaseGuide((await params).slug);
  if (!guide) notFound();
  const now = new Date();
  const status = guideStatus(guide, now);
  return <article className="release-guide">
    <nav className="guide-breadcrumb" aria-label="Breadcrumb"><a href="/whats-new">What’s new</a><span aria-hidden="true"> / </span><span>Unity {guide.version}</span></nav>
    <header className="guide-hero">
      <h1>What’s new in Unity {guide.version}?</h1>
      <GuideBadges guide={guide} now={now} />
    </header>
    <section aria-label="Features">
      <div className="guide-grid">{guideFeatures(guide).map((feature, index) => <FeatureCard key={feature.id} guide={guide} feature={feature} eager={index < 2} />)}</div>
    </section>
    <details className="guide-support">
      <summary>Support and release details</summary>
      <p><strong>{status.label}.</strong> {status.detail}</p>
      <p>Released <time dateTime={guide.released}>{formatGuideDate(guide.released)}</time> · Reviewed <time dateTime={guide.reviewed}>{formatGuideDate(guide.reviewed)}</time></p>
      <ExternalLink href={SUPPORT_SOURCE}>Unity’s support policy</ExternalLink>
    </details>
    <div className="guide-actions">
      <ExternalLink href={guide.source}>Release announcement</ExternalLink><a href={guideNotesHref(guide)}>Technical notes</a><a href="/compare">Compare versions</a>
    </div>
    <nav className="guide-release-nav" aria-label="Other release guides">{RELEASE_GUIDES.map(g => <a key={g.slug} href={guideHref(g)} aria-current={g.slug === guide.slug ? "page" : undefined}>Unity {g.version}{g.kind === "lts" ? " LTS" : ""}</a>)}</nav>
    <footer className="guide-footer">Independent guide. Launch highlights and images from Unity; image rights belong to their respective owners.</footer>
  </article>;
}
