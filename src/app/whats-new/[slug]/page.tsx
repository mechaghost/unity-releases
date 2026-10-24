import { notFound } from "next/navigation";
import { findReleaseGuide, guideHref, guideNotesHref, guideStatus, RELEASE_GUIDES, SUPPORT_SOURCE } from "@/lib/release-guides";
import { pageSocialMetadata } from "@/lib/site";
import { formatGuideDate } from "@/lib/release-guides";
import { ExternalLink } from "../../_components/ExternalLink";
import { GuideBadges, SupportExplainer } from "../GuideParts";

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
      <span className="guide-eyebrow">The release in two minutes</span>
      <h1>What’s new in Unity {guide.version}?</h1>
      <p className="guide-deck">{guide.summary}</p>
      <GuideBadges guide={guide} now={now} />
      <p className="guide-caption">Released <time dateTime={guide.released}>{formatGuideDate(guide.released)}</time> · Reviewed <time dateTime={guide.reviewed}>{formatGuideDate(guide.reviewed)}</time></p>
    </header>
    <aside className="guide-status" aria-label="Support for this release"><strong>{status.label}</strong><p>{status.detail}</p><ExternalLink href={SUPPORT_SOURCE}>Confirm support with Unity</ExternalLink></aside>
    <section aria-labelledby="guide-highlights-title"><div className="guide-section-heading"><h2 id="guide-highlights-title">Four changes worth knowing</h2>
      <p>{guide.version === "6.0" ? "The starting point for the Unity 6 family." : `Highlights introduced or improved since Unity 6.${Number(guide.version.split(".")[1]) - 1}.`} Later patch fixes are listed separately in the technical notes.</p></div>
      <div className="guide-grid">{guide.highlights.map((item, index) => <section className="guide-highlight" key={item.title} aria-labelledby={`highlight-${index}`}>
        <span className="guide-eyebrow">{item.category}</span><h3 id={`highlight-${index}`}>{item.title}</h3><p>{item.benefit}</p>
        <details><summary>What to consider</summary><p>{item.consideration}</p></details>
        <p className="guide-print-note"><strong>What to consider:</strong> {item.consideration}</p>
      </section>)}</div>
      <p className="guide-caption">Source for these highlights: <ExternalLink href={guide.source}>Unity {guide.version} launch announcement</ExternalLink></p>
    </section>
    <section className="guide-takeaway" aria-labelledby="guide-takeaway-title"><h2 id="guide-takeaway-title">What this means for your plans</h2><p>{guide.audience}</p>
      <p>{status.label === "Superseded" || status.label === "Standard support ended" ? "Use this guide to understand what changed historically. Review a currently supported release before choosing a version for a new project." : "Weigh these benefits against compatibility, testing time, and the support window. A newer release is not an automatic reason to migrate a working project."}</p>
      <p>Before committing, ask your team to check essential assets and plugins, test on target devices, and review the upgrade requirements.</p>
    </section>
    <SupportExplainer />
    <section className="guide-deeper" aria-labelledby="guide-deeper-title"><h2 id="guide-deeper-title">Go a little deeper</h2><div className="guide-actions">
      <ExternalLink href={guide.source}>Official announcement and demonstrations</ExternalLink><a href={guideNotesHref(guide)}>Search Unity {guide.version} technical notes</a><a href="/compare">Compare exact Editor versions</a>
    </div></section>
    <nav className="guide-release-nav" aria-label="Other release guides">{RELEASE_GUIDES.map(g => <a key={g.slug} href={guideHref(g)} aria-current={g.slug === guide.slug ? "page" : undefined}>Unity {g.version}{g.kind === "lts" ? " LTS" : ""}</a>)}</nav>
    <footer className="guide-footer">Independent editorial summary, not an official Unity recommendation. Sources and support checked {formatGuideDate(guide.reviewed)}. You can share this page or print it for your team.</footer>
  </article>;
}
