import { formatGuideDate } from "@/lib/release-guides";
import { pageSocialMetadata } from "@/lib/site";
import {
  UNITE_TOKYO_DATE, UNITE_TOKYO_PATH, UNITE_TOKYO_REVIEWED, UNITE_TOKYO_SECTIONS, UNITE_TOKYO_SOURCES
} from "@/lib/unite-tokyo";
import { ExternalLink } from "../../_components/ExternalLink";
import styles from "../tooling.module.css";

const title = "Unite Tokyo 2026";
const description = "What Unity announced in Tokyo, from Unity 6.7 LTS and Unity 7 to graphics, coding tools, platforms, and creator programs.";

export const metadata = {
  title, description,
  alternates: { canonical: UNITE_TOKYO_PATH },
  ...pageSocialMetadata({ title, description, path: UNITE_TOKYO_PATH })
};

export default function UniteTokyoPage() {
  return <article className={`release-guide ${styles.detail}`}>
    <nav className="guide-breadcrumb" aria-label="Breadcrumb">
      <a href="/">What’s new</a><span aria-hidden="true"> / </span><span>{title}</span>
    </nav>
    <header className="guide-hero">
      <h1>{title}</h1>
      <p>What Unity announced on <time dateTime={UNITE_TOKYO_DATE}>{formatGuideDate(UNITE_TOKYO_DATE)}</time> and which tools, samples, and Editor builds you can try.</p>
      <p className={styles.reviewed}>Sources checked <time dateTime={UNITE_TOKYO_REVIEWED}>{formatGuideDate(UNITE_TOKYO_REVIEWED)}</time>. Unity may change roadmap dates and preview features.</p>
    </header>
    <nav className={styles.jumpLinks} aria-label="On this page">
      {UNITE_TOKYO_SECTIONS.map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}
      <a href="#sources">Keynote and roadmap</a>
    </nav>
    {UNITE_TOKYO_SECTIONS.map(section => <section key={section.id} id={section.id} className={styles.section} aria-labelledby={`${section.id}-heading`}>
      <h2 id={`${section.id}-heading`}>{section.title}</h2>
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
      <ul className={styles.changes}>{UNITE_TOKYO_SOURCES.map(([label, href]) => <li key={href}><ExternalLink href={href}>{label}</ExternalLink></li>)}</ul>
    </section>
  </article>;
}
