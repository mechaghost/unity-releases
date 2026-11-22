import { UNITE_TOKYO } from "@/lib/unite-tokyo";
import { EventTopicGuide, eventTopicMetadata, resolveEventTopic, type EventTopicProps } from "../../EventTopicGuide";

export async function generateMetadata({ params }: EventTopicProps) {
  return eventTopicMetadata(UNITE_TOKYO, resolveEventTopic(UNITE_TOKYO, (await params).topic));
}

export default async function TokyoTopicPage({ params }: EventTopicProps) {
  return <EventTopicGuide event={UNITE_TOKYO} match={resolveEventTopic(UNITE_TOKYO, (await params).topic)} />;
}
