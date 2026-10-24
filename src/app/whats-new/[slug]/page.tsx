import { notFound } from "next/navigation";
import { findReleaseGuide, guideHref, guideNotesHref, guideStatus, RELEASE_GUIDES, SUPPORT_SOURCE } from "@/lib/release-guides";
import { pageSocialMetadata } from "@/lib/site";
import { formatGuideDate } from "@/lib/release-guides";
import { ExternalLink } from "../../_components/ExternalLink";
import { GuideBadges, FeatureImage } from "../GuideParts";

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
      <span className="guide-eyebrow">See what’s possible</span>
      <h1>What’s new in Unity {guide.version}?</h1>
      <p className="guide-deck">{guide.summary}</p>
      <GuideBadges guide={guide} now={now} />
      <p className="guide-caption">Released <time dateTime={guide.released}>{formatGuideDate(guide.released)}</time> · Reviewed <time dateTime={guide.reviewed}>{formatGuideDate(guide.reviewed)}</time></p>
    </header>
    <aside className="guide-status" aria-label="Support for this release"><strong>{status.label}</strong><p>{status.detail}</p><ExternalLink href={SUPPORT_SOURCE}>Confirm support with Unity</ExternalLink></aside>
    <section aria-labelledby="guide-highlights-title"><div className="guide-section-heading"><h2 id="guide-highlights-title">Explore the highlights</h2></div>
      <div className="guide-grid">{guide.highlights.map((item, index) => <section className="guide-highlight" key={item.title} aria-labelledby={`highlight-${index}`}>
        <FeatureImage image={item.image} eager={index < 2} />
        <div className="guide-highlight-copy"><span className="guide-eyebrow">{item.category}</span><h3 id={`highlight-${index}`}>{item.title}</h3><p>{item.benefit}</p>
        <details><summary>What to consider</summary><p>{item.consideration}</p></details>
        <p className="guide-print-note"><strong>What to consider:</strong> {item.consideration}</p></div>
      </section>)}</div>
      <p className="guide-caption">Source for these highlights: <ExternalLink href={guide.source}>Unity {guide.version} launch announcement</ExternalLink></p>
    </section>
    <section className="guide-deeper" aria-labelledby="guide-deeper-title"><h2 id="guide-deeper-title">Keep exploring</h2><div className="guide-actions">
      <ExternalLink href={guide.source}>Unity’s announcement</ExternalLink><a href={guideNotesHref(guide)}>Search Unity {guide.version} technical notes</a><a href="/compare">Compare exact Editor versions</a>
    </div></section>
    <nav className="guide-release-nav" aria-label="Other release guides">{RELEASE_GUIDES.map(g => <a key={g.slug} href={guideHref(g)} aria-current={g.slug === guide.slug ? "page" : undefined}>Unity {g.version}{g.kind === "lts" ? " LTS" : ""}</a>)}</nav>
    <footer className="guide-footer">Independent guide. Launch highlights and images from Unity; image rights belong to their respective owners.</footer>
  </article>;
}
