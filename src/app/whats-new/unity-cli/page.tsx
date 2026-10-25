import { TOOLING_GUIDES } from "@/lib/tooling-guides";
import { ToolingDetail, toolingMetadata } from "../ToolingGuides";
const guide = TOOLING_GUIDES.find(guide => guide.slug === "unity-cli")!;
export const metadata = toolingMetadata(guide);
export default function CliPage() { return <ToolingDetail guide={guide} />; }
