import { notFound } from "next/navigation";
import { findReleaseGuide, formatGuideDate, guideHref } from "@/lib/release-guides";
import { featureHref, featureTools, findGuideFeature, relatedFeatures } from "@/lib/release-features";
import { pageSocialMetadata } from "@/lib/site";
import { FeatureImage, GuideBadges } from "../../GuideParts";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string; feature: string }> };

async function resolveFeature(params: Props["params"]) {
  const route = await params;
  const guide = findReleaseGuide(route.slug);
  if (!guide) notFound();
  const feature = findGuideFeature(guide, route.feature);
  if (!feature) notFound();
  return { guide, feature };
}

export async function generateMetadata({ params }: Props) {
  const { guide, feature } = await resolveFeature(params);
  const title = `${feature.title} — Unity ${guide.version}`;
  const path = featureHref(guide, feature);
  return { title, description: feature.benefit, alternates: { canonical: path },
    ...pageSocialMetadata({ title, description: feature.benefit, path }) };
}

export default async function FeaturePage({ params }: Props) {
  const { guide, feature } = await resolveFeature(params);
  const details = feature.details;
  const notes = details.notes.length ? details.notes : feature.limitation ? [feature.limitation] : [];
  const tools = featureTools(guide, feature);
  const related = relatedFeatures(guide, feature);
  const references = [...details.links];
  for (const [label, url] of [[`Unity ${guide.version} release announcement`, guide.source], ["Unity feature article", feature.image.source]]) {
    if (!references.some(link => link.url === url)) references.push({ label, url });
  }
  return <article className="release-guide feature-detail">
    <nav className="guide-breadcrumb" aria-label="Breadcrumb">
      <a href="/whats-new">What’s new</a><span aria-hidden="true"> / </span>
      <a href={guideHref(guide)}>Unity {guide.version}</a><span aria-hidden="true"> / </span>
      <span aria-current="page">{feature.title}</span>
    </nav>
    <header className="guide-hero">
      <h1>{feature.title}</h1>
      <p className="feature-intro">{feature.benefit}</p>
      <div className="feature-release"><a href={guideHref(guide)}>Unity {guide.version}</a><GuideBadges guide={guide} now={new Date()} /></div>
      <a className="feature-primary-link btn btn--secondary" href={details.links[0].url}>{details.links[0].label} <span aria-hidden="true">↗</span></a>
    </header>
    <div className="feature-detail-layout">
      <div className="feature-detail-main">
        <FeatureImage image={feature.image} eager />
        <section aria-labelledby="what-changed">
          <h2 id="what-changed">What changed</h2>
          {details.technicalName !== feature.title && <p className="feature-technical-name">Unity feature: <strong>{details.technicalName}</strong></p>}
          {details.overview.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        </section>
        {details.steps.length > 0 && <section aria-labelledby="use-it">
          <h2 id="use-it">Use it</h2>
          <ol>{details.steps.map(step => <li key={step}>{step}</li>)}</ol>
        </section>}
        {notes.length > 0 && <section className="feature-requirements" aria-labelledby="requirements">
          <h2 id="requirements">Requirements and limits</h2>
          <ul>{notes.map(note => <li key={note}>{note}</li>)}</ul>
        </section>}
      </div>
      <aside className="feature-detail-sidebar" aria-label="Feature links">
        <section aria-labelledby="official-links">
          <h2 id="official-links">Official links</h2>
          <ul className="feature-link-list">{references.map(link => <li key={link.url}><a href={link.url}>{link.label} <span aria-hidden="true">↗</span></a></li>)}</ul>
        </section>
        <section aria-labelledby="on-this-site">
          <h2 id="on-this-site">On this site</h2>
          <ul className="feature-tool-list">{tools.map(tool => <li key={tool.href}><a href={tool.href}>{tool.label}</a><p>{tool.description}</p></li>)}</ul>
        </section>
      </aside>
    </div>
    {related.length > 0 && <section className="feature-related" aria-labelledby="related-features">
      <h2 id="related-features">Related features</h2>
      <ul>{related.map(item => <li key={item.feature.id}><a href={featureHref(item.guide, item.feature)}>{item.feature.title}<span>Unity {item.guide.version}</span></a></li>)}</ul>
    </section>}
    <footer className="guide-footer"><a href={guideHref(guide)}>All Unity {guide.version} features</a><p>Launch guide · Reviewed {formatGuideDate(guide.reviewed)}. Images and source material from Unity; rights remain with their owners.</p></footer>
  </article>;
}
