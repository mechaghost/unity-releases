import { UNITE_TOKYO } from "@/lib/unite-tokyo";
import { EventGuide, eventGuideMetadata } from "../EventGuide";

export const metadata = eventGuideMetadata(UNITE_TOKYO);

export default function UniteTokyoPage() {
  return <EventGuide event={UNITE_TOKYO} />;
}
