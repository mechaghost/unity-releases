import { TOOLING_GUIDES } from "@/lib/tooling-guides";
import { ToolingDetail, toolingMetadata } from "../ToolingGuides";
const guide = TOOLING_GUIDES.find(guide => guide.slug === "unity-pipeline")!;
export const metadata = toolingMetadata(guide);
export default function PipelinePage() { return <ToolingDetail guide={guide} />; }
