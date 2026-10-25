import { TOOLING_GUIDES, TOOLING_REVIEWED, type ToolingGuide } from "@/lib/tooling-guides";
import { formatGuideDate } from "@/lib/release-guides";
import { pageSocialMetadata } from "@/lib/site";
import { ExternalLink } from "../_components/ExternalLink";
import styles from "./tooling.module.css";

export function ToolingCards() {
  return <section className={styles.section} aria-labelledby="tooling-heading" id="pipeline-and-cli">
    <h2 id="tooling-heading">What’s new in Pipeline and CLI?</h2>
    <p className={styles.intro}>The tools behind automated Unity development. Explore new releases and what each tool can do.</p>
    <div className="guide-grid">{TOOLING_GUIDES.map(guide => <article className={`guide-card ${styles.card}`} key={guide.slug}>
      <a href={`/whats-new/${guide.slug}`} className={styles.cardLink}>
        <span className={styles.role}>{guide.role}</span><h3>{guide.name}</h3>
        <div className="guide-badges"><span className="guide-badge">{guide.status}</span><span className="guide-badge guide-badge--quiet">{guide.version}</span></div>
        <p>{guide.summary}</p>
        <div className={styles.latest}><span>Latest reviewed release · <time dateTime={guide.released}>{formatGuideDate(guide.released)}</time></span><strong>{guide.headline}</strong></div>
        <span className="guide-read">Explore features and updates <span aria-hidden="true">→</span></span>
      </a>
    </article>)}</div>
  </section>;
}

export function toolingMetadata(guide: ToolingGuide) {
  const title = `What’s new in ${guide.name}`;
  const path = `/whats-new/${guide.slug}`;
  return { title, description: guide.summary, alternates: { canonical: path }, ...pageSocialMetadata({ title, description: guide.summary, path }) };
}

export function ToolingDetail({ guide }: { guide: ToolingGuide }) {
  return <article className={`release-guide ${styles.detail}`}>
    <nav className="guide-breadcrumb" aria-label="Breadcrumb"><a href="/">What’s new</a><span aria-hidden="true"> / </span><span>{guide.name}</span></nav>
    <header className="guide-hero"><h1>What’s new in {guide.name}?</h1><p>{guide.summary}</p><div className="guide-badges"><span className="guide-badge">{guide.status}</span><span className="guide-badge guide-badge--quiet">{guide.version}</span></div><p className={styles.reviewed}>Reviewed <time dateTime={TOOLING_REVIEWED}>{formatGuideDate(TOOLING_REVIEWED)}</time> · Features and release highlights from Unity’s documentation.</p></header>
    <nav className={styles.jumpLinks} aria-label="On this page"><a href="#recent-changes">Recent changes</a><a href="#features">Features</a><a href="#setup">Setup and compatibility</a></nav>
    <section id="recent-changes" className={styles.section} aria-labelledby="changes-heading">
      <h2 id="changes-heading">Recent changes</h2><p>Latest reviewed: <strong>{guide.version}</strong> · <time dateTime={guide.released}>{formatGuideDate(guide.released)}</time></p>
      <h3>{guide.headline}</h3><ul className={styles.changes}>{guide.changes.map(change => <li key={change}>{change}</li>)}</ul>
      <aside className={styles.migration}><h3>Before you update</h3><p>{guide.migration}</p></aside>
      <p><ExternalLink href={guide.changelog}>Full release notes and version history</ExternalLink></p>
    </section>
    <section id="features" className={styles.section} aria-labelledby="features-heading">
      <h2 id="features-heading">What you can do</h2><p>Browse the documented feature areas. Each reference includes command details; availability depends on your installed version and project packages.</p>
      <div className={styles.features}>{guide.features.map(feature => <section key={feature.title} className={styles.feature}><h3>{feature.title}</h3><p>{feature.description}</p><ExternalLink href={feature.source}>Read {feature.title.toLowerCase()} reference</ExternalLink></section>)}</div>
    </section>
    <section id="setup" className={styles.section} aria-labelledby="setup-heading"><h2 id="setup-heading">Setup and compatibility</h2><p>{guide.requirements}</p><p><ExternalLink href={guide.setupSource}>Installation and setup instructions</ExternalLink></p><p>{guide.slug === "unity-pipeline" ? "Open your project in Unity, then run these commands from its folder. After installation, check for Pipeline: Installed." : "Install the CLI for your operating system using the instructions above, reopen your terminal, then check your setup."}</p><pre className={styles.code}><code>{guide.setup}</code></pre></section>
    <nav className="guide-actions" aria-label="Related guides">{TOOLING_GUIDES.filter(other => other.slug !== guide.slug).map(other => <a key={other.slug} href={`/whats-new/${other.slug}`}>Explore {other.name}</a>)}<a href="/guides/agentic-coding-with-unity">Coding-agent workflows</a></nav>
    <footer className="guide-footer">Independent guide. Release highlights are curated; use the official references for the complete command syntax and changelog.</footer>
  </article>;
}
