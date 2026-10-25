import { RELEASE_GUIDES, guideStatus } from "@/lib/release-guides";
import { pageSocialMetadata } from "@/lib/site";
import { GuideCard } from "../GuideParts";

export const dynamic = "force-dynamic";
const description = "Browse the features introduced in superseded Unity releases.";
export const metadata = {
  title: "Past Unity releases", description,
  alternates: { canonical: "/whats-new/past-releases" },
  ...pageSocialMetadata({ title: "Past Unity releases", description, path: "/whats-new/past-releases" })
};

export default function PastReleasesPage() {
  const now = new Date();
  const guides = RELEASE_GUIDES.filter(guide => guideStatus(guide, now).label === "Superseded");
  return <div className="release-guide">
    <nav className="guide-breadcrumb" aria-label="Breadcrumb"><a href="/whats-new">What’s new</a><span aria-hidden="true"> / </span><span>Past releases</span></nav>
    <header className="guide-hero">
      <h1>Past releases</h1>
      <p>These versions have been superseded and are no longer supported.</p>
    </header>
    <section aria-label="Past release guides">
      <div className="guide-grid">{guides.map((guide, index) => <GuideCard key={guide.slug} guide={guide} now={now} eager={index < 2} />)}</div>
      {guides.length === 0 && <p>No superseded releases yet.</p>}
    </section>
  </div>;
}
