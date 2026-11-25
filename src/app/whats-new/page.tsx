import { LocalUpdatedTime } from "../_components/LocalUpdatedTime";
import { lastDataUpdate } from "@/lib/last-data-update";
import { RELEASE_GUIDES, RELEASE_GUIDES_REVIEWED, formatGuideDate, guideStatus } from "@/lib/release-guides";
import { pageSocialMetadata } from "@/lib/site";
import { UNITY_EVENTS_PATH } from "@/lib/unite-event-paths";
import { GuideCard } from "./GuideParts";
import { ToolingCards } from "./ToolingGuides";
import { MoreUpdates } from "./MoreUpdates";
import { EngineFeatureCards } from "./by-feature/EngineFeatureCards";
import { EventCards } from "./events/EventCards";
import engineFeatureStyles from "./by-feature/engine-features.module.css";

export const dynamic = "force-dynamic";
const description = "Explore what changed across Unity 6 releases and check the support status of each version.";
export const metadata = {
  title: "What’s new in Unity", description,
  alternates: { canonical: "/" },
  ...pageSocialMetadata({ title: "What’s new in Unity", description, path: "/" })
};

export default async function WhatsNewPage() {
  const updatedAt = await lastDataUpdate();
  const now = new Date();
  const released = RELEASE_GUIDES.filter(g => g.released <= now.toISOString().slice(0, 10) && guideStatus(g, now).label !== "Superseded");
  return <div className="release-guide">
    <header className="guide-hero page-header__title-row"><h1>What’s new in Unity?</h1><LocalUpdatedTime timestamp={updatedAt} /></header>
    <section id="release-guides" aria-label="Release guides">
      <div className="guide-grid">{released.map((guide, index) => <GuideCard key={guide.slug} guide={guide} now={now} eager={index === 0} highPriority={index === 0} />)}</div>
      <nav className="guide-browse-links" aria-label="Browse release guides">
        <a href="/whats-new/unity-6-features">Browse all Unity 6 features <span aria-hidden="true">→</span></a>
        <a href="/whats-new/past-releases">Past releases <span aria-hidden="true">→</span></a>
      </nav>
    </section>
    <section className={engineFeatureStyles.areaSection} aria-labelledby="unity-events-heading">
      <h2 id="unity-events-heading">Events</h2>
      <EventCards headingLevel={3} />
      <nav className="guide-browse-links" aria-label="Browse events">
        <a href={UNITY_EVENTS_PATH}>All events <span aria-hidden="true">→</span></a>
      </nav>
    </section>
    <section className={engineFeatureStyles.areaSection} aria-labelledby="browse-engine-features">
      <h2 id="browse-engine-features">Browse by engine feature</h2>
      <EngineFeatureCards headingLevel={3} />
    </section>
    <ToolingCards />
    <MoreUpdates />
    <footer className="guide-footer">Independent guides · Reviewed <time dateTime={RELEASE_GUIDES_REVIEWED}>{formatGuideDate(RELEASE_GUIDES_REVIEWED)}</time>. <a href="/releases">All Editor releases</a></footer>
  </div>;
}
