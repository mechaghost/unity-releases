import { formatGuideDate } from "@/lib/release-guides";
import { pageSocialMetadata } from "@/lib/site";
import { UNITY_EVENTS_PATH } from "@/lib/unite-event-paths";
import { eventTopicHref, UNITE_EVENTS, type UniteEvent } from "@/lib/unite-events";
import { ExternalLink } from "../_components/ExternalLink";
import { Icon } from "../_components/Icon";
import { GuideHighlightCard } from "./GuideParts";
import styles from "./tooling.module.css";
import media from "./event-guide.module.css";

export function eventGuideMetadata({ title, path, description }: UniteEvent) {
  return {
    title, description,
    alternates: { canonical: path },
    ...pageSocialMetadata({ title, description, path })
  };
}

export function EventGuide({ event }: { event: UniteEvent }) {
  const photo = event.keynoteImage;
  return <article className="release-guide">
    <nav className="guide-breadcrumb" aria-label="Breadcrumb">
      <a href="/">What’s new</a><span aria-hidden="true"> / </span>
      <a href={UNITY_EVENTS_PATH}>Events</a><span aria-hidden="true"> / </span>
      <span aria-current="page">{event.title}</span>
    </nav>
    <header className={`guide-hero ${media.hero} ${styles.detail}`}>
      <div>
        <h1>{event.title}</h1>
        <p><time dateTime={event.date}>{formatGuideDate(event.date)}</time> · {event.description}</p>
        <p className={styles.reviewed}>Sources checked <time dateTime={event.reviewed}>{formatGuideDate(event.reviewed)}</time>. Unity may change roadmap dates and preview features.</p>
        <div className={media.recordings}>
          {event.recordings.map(([label, href]) => <ExternalLink className="btn btn--secondary" key={href} href={href}>
            {label}<Icon name="external-link" size={14} />
          </ExternalLink>)}
        </div>
      </div>
      <figure className="guide-figure">
        <a className={`guide-image-link ${media.image}`} href={photo.src} aria-label={`Enlarge image: ${photo.alt}`}>
          <img src={photo.src} width={photo.width} height={photo.height} alt={photo.alt} decoding="async" />
        </a>
        <figcaption><ExternalLink href={photo.source}>Photo from Unity’s keynote recap</ExternalLink></figcaption>
      </figure>
    </header>
    <nav className={styles.jumpLinks} aria-label="On this page">
      {event.sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}
      <a href="#sources">Keynote and roadmap</a>
    </nav>
    {event.sections.map(section => <section key={section.id} id={section.id} className={styles.section} aria-labelledby={`${section.id}-heading`}>
      <h2 id={`${section.id}-heading`}>{section.title}</h2>
      <div className="guide-grid">{section.topics.map(topic =>
        <GuideHighlightCard key={topic.slug} href={eventTopicHref(event, topic)} headingId={`topic-${topic.slug}`}
          title={topic.title} summary={topic.teaser} headingLevel={3} action="Explore topic"
          image={section.demos?.find(demo => demo.topicSlug === topic.slug)?.image}>
          {topic.status && <span className="guide-badge guide-badge--quiet">{topic.status}</span>}
        </GuideHighlightCard>
      )}</div>
      {section.demos && <nav className="guide-browse-links" aria-label={`${section.title} demos`}>
        {section.demos.map(({ video: [label, href] }) => <ExternalLink key={href} href={href}>{label}</ExternalLink>)}
      </nav>}
    </section>)}
    <section id="sources" className={styles.section} aria-labelledby="sources-heading">
      <h2 id="sources-heading">Keynote and roadmap</h2>
      <ul className={styles.changes}>{event.sources.map(([label, href]) => <li key={href}><ExternalLink href={href}>{label}</ExternalLink></li>)}</ul>
    </section>
    <nav className="guide-actions" aria-label="Other events">
      <a href={UNITY_EVENTS_PATH}>All events</a>
      {UNITE_EVENTS.filter(other => other.path !== event.path).map(other =>
        <a key={other.path} href={other.path}>{other.title}</a>
      )}
    </nav>
  </article>;
}
