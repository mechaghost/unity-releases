import { notFound } from "next/navigation";
import {
  ENGINE_FEATURE_AREAS,
  ENGINE_FEATURES_PATH,
  engineFeatureHref,
  engineFeatureReleases,
  findEngineFeatureArea,
  type EngineFeatureArticle
} from "@/lib/engine-features";
import { guideHref } from "@/lib/release-guides";
import { pageSocialMetadata } from "@/lib/site";
import { Icon } from "../../../_components/Icon";
import { FeatureCard } from "../../GuideParts";
import styles from "../engine-features.module.css";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ area: string }> };

async function resolveArea(params: Props["params"]) {
  const area = findEngineFeatureArea((await params).area);
  if (!area) notFound();
  return area;
}

export async function generateMetadata({ params }: Props) {
  const area = await resolveArea(params);
  const title = `${area.name} in Unity 6`;
  const description = `${area.description} Explore changes by Unity release.`;
  const path = engineFeatureHref(area);
  return { title, description, alternates: { canonical: path }, ...pageSocialMetadata({ title, description, path }) };
}

function ArticleCard({ article }: { article: EngineFeatureArticle }) {
  return (
    <article className="guide-highlight">
      <a className="guide-feature-link" href={article.href}>
        <div className={`guide-highlight-copy ${styles.articleCopy}`}>
          <span className={styles.source}>{article.source} <Icon name="external-link" size={13} /></span>
          <h3 className="guide-feature-title">{article.title}</h3>
          <p>{article.description}</p>
        </div>
      </a>
    </article>
  );
}

export default async function EngineFeatureAreaPage({ params }: Props) {
  const area = await resolveArea(params);
  const groups = engineFeatureReleases(area);
  return (
    <div className="release-guide">
      <nav className="guide-breadcrumb" aria-label="Breadcrumb">
        <a href="/">What’s new</a><span aria-hidden="true"> / </span>
        <a href={ENGINE_FEATURES_PATH}>Engine features</a><span aria-hidden="true"> / </span>
        <span aria-current="page">{area.name}</span>
      </nav>
      <header className="guide-hero">
        <h1>{area.name} in Unity 6</h1>
        <p>{area.description}</p>
      </header>
      <nav className={`guide-release-nav ${styles.areaLinks}`} aria-label="Engine feature areas">
        {ENGINE_FEATURE_AREAS.map(item => <a key={item.slug} href={engineFeatureHref(item)} aria-current={area.slug === item.slug ? "page" : undefined}>{item.name}</a>)}
      </nav>
      <nav className={styles.versionLinks} aria-label="Jump to a Unity release">
        <span>Jump to</span>
        {groups.map(({ guide }) => <a key={guide.version} href={`#${guide.slug}`}>Unity {guide.version}</a>)}
      </nav>
      {groups.map(({ guide, features, articles }, groupIndex) => (
        <section className={styles.release} key={guide.slug} aria-labelledby={guide.slug}>
          <div className={styles.releaseHeader}>
            <h2 id={guide.slug} tabIndex={-1}>Unity {guide.version}{guide.kind === "lts" ? " LTS" : ""}</h2>
            <div className={styles.releaseLinks}>
              <a href={guideHref(guide)} aria-label={`Full release guide for Unity ${guide.version}`}>Full release guide <Icon name="arrow-right" size={14} /></a>
              {!articles.some(article => article.href === guide.source) && <a href={guide.source} aria-label={`Unity announcement for ${guide.version}`}>Unity announcement <Icon name="external-link" size={13} /></a>}
            </div>
          </div>
          {features.length > 0 && <div className={`guide-grid ${styles.featureGrid}`}>
            {features.map((feature, index) => <FeatureCard key={feature.id} guide={guide} feature={feature} headingLevel={3} eager={groupIndex === 0 && index < 2} />)}
          </div>}
          {articles.length > 0 && <div className={`guide-grid ${styles.articleGrid}`}>
            {articles.map(article => <ArticleCard key={article.href} article={article} />)}
          </div>}
        </section>
      ))}
      <footer className="guide-footer"><a href="/whats-new/unity-6-features">Browse all Unity 6 features</a></footer>
    </div>
  );
}
