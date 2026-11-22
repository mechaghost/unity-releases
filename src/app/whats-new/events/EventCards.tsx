import { formatGuideDate } from "@/lib/release-guides";
import { UNITE_EVENTS } from "@/lib/unite-events";
import { Chip } from "../../_components/Chip";
import { GuideHighlightCard } from "../GuideParts";

export function EventCards({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  return <div className="guide-grid">
    {UNITE_EVENTS.map(event => <GuideHighlightCard
      key={event.path}
      href={event.path}
      headingId={`event-card-${event.path.split("/").at(-1)}`}
      title={event.title}
      summary={event.cardSummary}
      image={event.keynoteImage}
      action="Explore event"
      headingLevel={headingLevel}>
      <Chip className="chip--area"><time dateTime={event.date}>{formatGuideDate(event.date)}</time></Chip>
    </GuideHighlightCard>)}
  </div>;
}
