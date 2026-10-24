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

export default function WhatsNewPage() {
  const now = new Date();
  const released = RELEASE_GUIDES.filter(g => g.released <= now.toISOString().slice(0, 10) && guideStatus(g, now).label !== "Superseded");
  return <div className="release-guide">
    <header className="guide-hero page-header__title-row"><h1>What’s new in Unity?</h1><a className="btn btn--secondary" href="/compare">Compare versions</a></header>
    <section id="release-guides" aria-label="Release guides">
      <div className="guide-grid">{released.map((guide, index) => <GuideCard key={guide.slug} guide={guide} now={now} eager={index < 2} />)}</div>
    </section>
    <SupportExplainer />
    <MoreUpdates />
    <footer className="guide-footer">Independent guides · Reviewed October 24, 2026. <a href="/releases">All Editor releases</a></footer>
  </div>;
}
