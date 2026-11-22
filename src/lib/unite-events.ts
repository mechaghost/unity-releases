import type { GuideImage } from "./release-guides";
import { UNITE_SEOUL } from "./unite-seoul";
import { UNITE_TOKYO } from "./unite-tokyo";

export type EventLink = readonly [label: string, href: string];
export type EventDemo = { image: GuideImage; video: EventLink; credit: string };
type EventTopic = { title: string; status?: string; summary: string; links: EventLink[] };
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
