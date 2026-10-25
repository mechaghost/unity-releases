import { LocalUpdatedTime } from "../_components/LocalUpdatedTime";
import { lastDataUpdate } from "@/lib/last-data-update";
import { RELEASE_GUIDES, guideStatus } from "@/lib/release-guides";
import { pageSocialMetadata } from "@/lib/site";
import { GuideCard, SupportExplainer } from "./GuideParts";
import { MoreUpdates } from "./MoreUpdates";

export const dynamic = "force-dynamic";
const description = "Discover what changed in Unity 6.0 through 6.6, why it matters, and how LTS and Supported Update releases differ.";
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
      <div className="guide-grid">{released.map((guide, index) => <GuideCard key={guide.slug} guide={guide} now={now} eager={index < 2} />)}</div>
      <nav className="guide-browse-links" aria-label="Browse release guides">
        <a href="/whats-new/unity-6-features">Browse all Unity 6 features <span aria-hidden="true">→</span></a>
        <a href="/whats-new/past-releases">Past releases <span aria-hidden="true">→</span></a>
      </nav>
    </section>
    <SupportExplainer />
    <MoreUpdates />
    <footer className="guide-footer">Independent guides · Reviewed October 24, 2026. <a href="/releases">All Editor releases</a></footer>
  </div>;
}
