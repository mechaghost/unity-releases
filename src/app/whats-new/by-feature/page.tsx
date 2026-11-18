import { ENGINE_FEATURES_PATH } from "@/lib/engine-features";
import { pageSocialMetadata } from "@/lib/site";
import { EngineFeatureCards } from "./EngineFeatureCards";
import styles from "./engine-features.module.css";

const title = "What’s new by engine feature";
const description = "Explore what changed across Unity 6 releases, with links to Unity articles, tutorials, and staff posts.";

export const dynamic = "force-dynamic";
export const metadata = {
  title,
  description,
  alternates: { canonical: ENGINE_FEATURES_PATH },
  ...pageSocialMetadata({ title, description, path: ENGINE_FEATURES_PATH })
};

export default function EngineFeaturesPage() {
  return (
    <div className="release-guide">
      <nav className="guide-breadcrumb" aria-label="Breadcrumb">
        <a href="/">What’s new</a><span aria-hidden="true"> / </span><span aria-current="page">Engine features</span>
      </nav>
      <header className="guide-hero">
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <EngineFeatureCards />
      <footer className={`guide-footer ${styles.indexFooter}`}><a href="/whats-new/unity-6-features">Browse all Unity 6 features</a></footer>
    </div>
  );
}
