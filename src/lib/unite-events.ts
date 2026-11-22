import type { GuideImage } from "./release-guides";
import { UNITE_SEOUL } from "./unite-seoul";
import { UNITE_TOKYO } from "./unite-tokyo";

export type EventLink = readonly [label: string, href: string];
export type EventDemo = { topicSlug: string; image: GuideImage; video: EventLink; credit: string };
export type EventTopic = {
  slug: string;
  title: string;
  teaser: string;
  status?: string;
  summary: string;
  links: EventLink[];
};
export type EventSection = { id: string; title: string; topics: EventTopic[]; demos?: EventDemo[] };
export type UniteEvent = {
  path: string;
  title: string;
  description: string;
  cardSummary: string;
  date: string;
  reviewed: string;
  keynoteImage: GuideImage;
  recordings: EventLink[];
  sections: EventSection[];
  sources: EventLink[];
};

export const UNITE_EVENTS: readonly UniteEvent[] = [UNITE_TOKYO, UNITE_SEOUL];

export function eventTopicHref(event: UniteEvent, topic: EventTopic) {
  return `${event.path}/${topic.slug}`;
}

export function findEventTopic(event: UniteEvent, slug: string) {
  for (const section of event.sections) {
    const topic = section.topics.find(candidate => candidate.slug === slug);
    if (topic) return { section, topic };
  }
}
