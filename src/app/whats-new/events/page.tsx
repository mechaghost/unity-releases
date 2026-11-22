import { pageSocialMetadata } from "@/lib/site";
import { UNITY_EVENTS_PATH } from "@/lib/unite-event-paths";
import { EventCards } from "./EventCards";

const title = "Events";
const description = "Explore Unity’s feature announcements, demos, and recordings from Unite Tokyo and Unite Seoul.";

export const metadata = {
  title, description,
  alternates: { canonical: UNITY_EVENTS_PATH },
  ...pageSocialMetadata({ title, description, path: UNITY_EVENTS_PATH })
};

export default function EventsPage() {
  return <div className="release-guide">
    <nav className="guide-breadcrumb" aria-label="Breadcrumb">
      <a href="/">What’s new</a><span aria-hidden="true"> / </span><span aria-current="page">{title}</span>
    </nav>
    <header className="guide-hero">
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
    <EventCards />
  </div>;
}
