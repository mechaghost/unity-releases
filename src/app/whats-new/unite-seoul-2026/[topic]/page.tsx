import { UNITE_SEOUL } from "@/lib/unite-seoul";
import { EventTopicGuide, eventTopicMetadata, resolveEventTopic, type EventTopicProps } from "../../EventTopicGuide";

export async function generateMetadata({ params }: EventTopicProps) {
  return eventTopicMetadata(UNITE_SEOUL, resolveEventTopic(UNITE_SEOUL, (await params).topic));
}

export default async function SeoulTopicPage({ params }: EventTopicProps) {
  return <EventTopicGuide event={UNITE_SEOUL} match={resolveEventTopic(UNITE_SEOUL, (await params).topic)} />;
}
