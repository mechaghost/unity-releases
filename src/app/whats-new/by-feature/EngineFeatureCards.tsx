import { ENGINE_FEATURE_AREAS, engineFeatureHref } from "@/lib/engine-features";
import { unity6Features } from "@/lib/unity6-features";
import { Icon } from "../../_components/Icon";
import styles from "./engine-features.module.css";

export function EngineFeatureCards({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  const images = new Map(unity6Features().map(({ feature }) => [feature.id, feature.image]));
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <div className={styles.areaGrid}>
      {ENGINE_FEATURE_AREAS.map(area => {
        const image = images.get(area.cover);
        const headingId = `engine-area-${area.slug}`;
        return (
          <article className={`guide-highlight ${styles.areaCard}`} key={area.slug}>
            <a className="guide-feature-link" href={engineFeatureHref(area)} aria-labelledby={headingId}>
              {image && <div className="guide-feature-image">
                <img src={image.src} alt="" width={image.width} height={image.height} loading="lazy" decoding="async" />
              </div>}
              <div className={`guide-highlight-copy ${styles.areaCopy}`}>
                <Heading id={headingId} className="guide-feature-title">{area.name}</Heading>
                <p>{area.description}</p>
                <Icon name="arrow-right" className={styles.cardArrow} />
              </div>
            </a>
          </article>
        );
      })}
    </div>
  );
}
