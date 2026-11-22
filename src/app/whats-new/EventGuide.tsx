import type { ReactNode } from "react";
import { formatGuideDate, type GuideImage } from "@/lib/release-guides";
import { pageSocialMetadata } from "@/lib/site";
import { UNITY_EVENTS_PATH } from "@/lib/unite-event-paths";
import { UNITE_EVENTS, type UniteEvent } from "@/lib/unite-events";
import { ExternalLink } from "../_components/ExternalLink";
import { Icon } from "../_components/Icon";
import styles from "./tooling.module.css";
import media from "./event-guide.module.css";

export function eventGuideMetadata({ title, path, description }: UniteEvent) {
  return {
    title, description,
    alternates: { canonical: path },
    ...pageSocialMetadata({ title, description, path })
  };
}

function EventFigure({ image, eager = false, children }: { image: GuideImage; eager?: boolean; children: ReactNode }) {
  return <figure className="guide-figure">
    <a className={`guide-image-link ${media.image}`} href={image.src} aria-label={`Enlarge image: ${image.alt}`}>
      <img src={image.src} width={image.width} height={image.height} alt={image.alt}
        loading={eager ? "eager" : "lazy"} decoding="async" />
    </a>
    <figcaption>{children}</figcaption>
  </figure>;
}

export function EventGuide({ event }: { event: UniteEvent }) {
  return <article className={`release-guide ${styles.detail}`}>
    <nav className="guide-breadcrumb" aria-label="Breadcrumb">
      <a href="/">What’s new</a><span aria-hidden="true"> / </span>
      <a href={UNITY_EVENTS_PATH}>Events</a><span aria-hidden="true"> / </span>
      <span aria-current="page">{event.title}</span>
    </nav>
    <header className={`guide-hero ${media.hero}`}>
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
      <EventFigure image={event.keynoteImage} eager>
        <ExternalLink href={event.keynoteImage.source}>Photo from Unity’s keynote recap</ExternalLink>
      </EventFigure>
    </header>
    <nav className={styles.jumpLinks} aria-label="On this page">
      {event.sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}
      <a href="#sources">Keynote and roadmap</a>
    </nav>
    {event.sections.map(section => <section key={section.id} id={section.id} className={styles.section} aria-labelledby={`${section.id}-heading`}>
      <h2 id={`${section.id}-heading`}>{section.title}</h2>
      {section.demos && <div className={media.demos}>
        {section.demos.map(({ image, video: [label, href], credit }) => <EventFigure key={image.src} image={image}>
          <ExternalLink className={media.demoLink} href={href}>{label}</ExternalLink>
          <ExternalLink href={image.source}>{credit}</ExternalLink>
        </EventFigure>)}
      </div>}
      <div className={styles.features}>{section.topics.map(topic => <section key={topic.title} className={styles.feature}>
        <h3>{topic.title}</h3>
        {topic.status && <div className="guide-badges"><span className="guide-badge guide-badge--quiet">{topic.status}</span></div>}
        <p>{topic.summary}</p>
        <ul className={styles.changes}>{topic.links.map(([label, href]) => <li key={href}>
          {href.startsWith("/") ? <a href={href}>{label}</a> : <ExternalLink href={href}>{label}</ExternalLink>}
        </li>)}</ul>
      </section>)}</div>
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
