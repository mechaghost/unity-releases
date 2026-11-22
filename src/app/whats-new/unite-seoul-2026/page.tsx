import { UNITE_SEOUL } from "@/lib/unite-seoul";
import { EventGuide, eventGuideMetadata } from "../EventGuide";

export const metadata = eventGuideMetadata(UNITE_SEOUL);

export default function UniteSeoulPage() {
  return <EventGuide event={UNITE_SEOUL} />;
}
