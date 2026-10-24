import { RELEASE_GUIDES, guideStatus } from "@/lib/release-guides";
import { pageSocialMetadata } from "@/lib/site";
import { GuideCard, SupportExplainer } from "./GuideParts";

export const dynamic = "force-dynamic";
const description = "Discover what changed in Unity 6.0 through 6.6, why it matters, and how LTS and Supported Update releases differ.";
export const metadata = {
  title: "What’s new in Unity", description,
  alternates: { canonical: "/whats-new" },
  ...pageSocialMetadata({ title: "What’s new in Unity", description, path: "/whats-new" })
};

export default function WhatsNewPage() {
  const now = new Date();
  const released = RELEASE_GUIDES.filter(g => g.released <= now.toISOString().slice(0, 10));
  const featured = [released.find(g => g.kind === "update"), released.find(g => g.kind === "lts" && guideStatus(g, now).active)]
    .filter((g): g is typeof RELEASE_GUIDES[number] => Boolean(g));
  const earlier = released.filter(g => !featured.includes(g));
  return <div className="release-guide">
    <header className="guide-hero">
      <span className="guide-eyebrow">The bigger picture</span>
      <h1>What’s new in Unity?</h1>
      <p className="guide-deck">Understand what changed, who benefits, and what to consider before choosing a release.</p>
      <p className="guide-caption">One guide per release — Unity 6.0, 6.1, and beyond. The highlights, without the patch-by-patch detail.</p>
      <div className="guide-actions"><a className="btn btn--primary" href="#release-guides">Explore the guides</a><a href="#support">LTS or Supported Update?</a></div>
    </header>
    <section id="release-guides" aria-labelledby="guide-featured-title">
      <div className="guide-section-heading"><span className="guide-eyebrow">Choose your starting point</span><h2 id="guide-featured-title">Latest reviewed releases</h2>
        <p>Compare what each offers and check its current support label.</p></div>
      <div className="guide-grid">{featured.map(guide => <GuideCard key={guide.slug} guide={guide} now={now} featured />)}</div>
    </section>
    <SupportExplainer />
    <section aria-labelledby="guide-earlier-title"><div className="guide-section-heading"><h2 id="guide-earlier-title">Explore earlier releases</h2><p>See when a capability arrived. Some earlier LTS releases remain supported.</p></div>
      <div className="guide-grid">{earlier.map(guide => <GuideCard key={guide.slug} guide={guide} now={now} />)}</div>
    </section>
    <footer className="guide-footer"><p>Independent summaries based on Unity’s official announcements. Highlights describe the release at launch; they are not a list of every later patch.</p>
      <p>Content and support reviewed October 24, 2026. New guides are published after review. <a href="/releases">Browse all indexed Editor releases</a> for newer patches and previews.</p></footer>
  </div>;
}
