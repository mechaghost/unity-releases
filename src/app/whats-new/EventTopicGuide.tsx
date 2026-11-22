import { notFound } from "next/navigation";
import { pageSocialMetadata } from "@/lib/site";
import { UNITY_EVENTS_PATH } from "@/lib/unite-event-paths";
import { eventTopicHref, findEventTopic, type UniteEvent } from "@/lib/unite-events";
import { ExternalLink } from "../_components/ExternalLink";
import { FeatureImage } from "./GuideParts";

export type EventTopicProps = { params: Promise<{ topic: string }> };

export function resolveEventTopic(event: UniteEvent, slug: string) {
  const match = findEventTopic(event, slug);
  if (!match) notFound();
  return match;
}

type TopicMatch = ReturnType<typeof resolveEventTopic>;

export function eventTopicMetadata(event: UniteEvent, { topic }: TopicMatch) {
  const title = `${topic.title} · ${event.title}`;
  const path = eventTopicHref(event, topic);
  return {
    title,
    description: topic.teaser,
    alternates: { canonical: path },
    ...pageSocialMetadata({ title, description: topic.teaser, path })
  };
}

export function EventTopicGuide({ event, match: { section, topic } }: { event: UniteEvent; match: TopicMatch }) {
  const sectionHref = `${event.path}#${section.id}`;
  const demo = section.demos?.find(candidate => candidate.topicSlug === topic.slug);
  const related = section.topics.filter(candidate => candidate.slug !== topic.slug);
  const officialLinks = topic.links.filter(([, href]) => !href.startsWith("/"));
  const siteLinks = topic.links.filter(([, href]) => href.startsWith("/"));
  const references = demo ? [demo.video, [demo.credit, demo.image.source] as const, ...officialLinks] : officialLinks;
  // A sample can also be listed as a setup resource for its topic.
  const uniqueReferences = new Map(references.map(([label, href]) => [href, label]));

  return <article className="release-guide feature-detail">
    <nav className="guide-breadcrumb" aria-label="Breadcrumb">
      <a href="/">What’s new</a><span aria-hidden="true"> / </span>
      <a href={UNITY_EVENTS_PATH}>Events</a><span aria-hidden="true"> / </span>
      <a href={event.path}>{event.title}</a><span aria-hidden="true"> / </span>
      <span aria-current="page">{topic.title}</span>
    </nav>
    <header className="guide-hero">
      <h1>{topic.title}</h1>
      <p className="feature-intro">{topic.teaser}</p>
      <div className="feature-release">
        <a href={sectionHref}>{section.title}</a>
        {topic.status && <div className="guide-badges"><span className="guide-badge guide-badge--quiet">{topic.status}</span></div>}
      </div>
    </header>
    <div className="feature-detail-layout">
      <div className="feature-detail-main">
        {demo && <FeatureImage image={demo.image} eager />}
        <section aria-labelledby="what-changed">
          <h2 id="what-changed">What changed</h2>
          <p>{topic.summary}</p>
        </section>
      </div>
      <aside className="feature-detail-sidebar" aria-label="Topic links">
        {uniqueReferences.size > 0 && <section aria-labelledby="official-links">
          <h2 id="official-links">Official links</h2>
          <ul className="feature-link-list">{[...uniqueReferences].map(([href, label]) =>
            <li key={href}><ExternalLink href={href}>{label}</ExternalLink></li>
          )}</ul>
        </section>}
        {siteLinks.length > 0 && <section aria-labelledby="on-this-site">
          <h2 id="on-this-site">On this site</h2>
          <ul className="feature-link-list">{siteLinks.map(([label, href]) =>
            <li key={href}><a href={href}>{label}</a></li>
          )}</ul>
        </section>}
      </aside>
    </div>
    {related.length > 0 && <section className="feature-related" aria-labelledby="related-topics">
      <h2 id="related-topics">Related topics</h2>
      <ul>{related.map(candidate => <li key={candidate.slug}><a href={eventTopicHref(event, candidate)}>{candidate.title}</a></li>)}</ul>
    </section>}
    <footer className="guide-footer"><a href={sectionHref}>Back to {section.title}</a></footer>
  </article>;
}
