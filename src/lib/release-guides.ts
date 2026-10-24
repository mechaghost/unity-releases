import images from "./release-guide-images.json" with { type: "json" };

/** Reviewed editorial content. Keep launch highlights separate from later patches.
 * See docs/release-guides.md before adding a release or changing support dates. */
export type GuideImage = { src: string; alt: string; width: number; height: number; original: string; source: string };
export type GuideHighlight = { category: string; title: string; benefit: string; limitation?: string; image: GuideImage };
type HighlightCopy = Omit<GuideHighlight, "image">;
export type ReleaseGuide = {
  version: string;
  slug: string;
  kind: "lts" | "update";
  released: string;
  reviewed: string;
  supportThrough?: string; // YYYY-MM, as published by Unity (not an invented day).
  extendedThrough?: string;
  summary: string;
  audience: string;
  source: string;
  highlights: GuideHighlight[];
};
export const SUPPORT_SOURCE = "https://unity.com/releases/unity-6/support";
const highlight = (category: string, title: string, benefit: string, limitation?: string): HighlightCopy =>
  ({ category, title, benefit, limitation });
const guide = (version: string, kind: ReleaseGuide["kind"], released: string, summary: string, audience: string,
  source: string, highlights: HighlightCopy[], supportThrough?: string, extendedThrough?: string): ReleaseGuide =>
  ({ version, slug: `unity-${version.replace(".", "-")}`, kind, released, reviewed: "2026-10-24", summary, audience, source, highlights: highlights.map((item, index) => {
    const image = (images as Record<string, Omit<GuideImage, "source"> & { source?: string }>)[`${version}-${index}`];
    return { ...item, image: { ...image, source: image.source ?? source } };
  }), supportThrough, extendedThrough });

export const RELEASE_GUIDES: readonly ReleaseGuide[] = [
  guide("6.6", "update", "2026-09-01", "2D lighting, faster testing, and build reports.",
    "Teams looking to shorten everyday development loops and understand what makes their game large or slow to build.",
    "https://discussions.unity.com/t/unity-6-6-is-now-available/1735357", [
      highlight("2D visuals", "Control 2D lighting", "Choose which lights affect each character or object in a 2D scene.", "Requires the Universal Render Pipeline (URP) 2D renderer."),
      highlight("Lighting", "Faster lighting calculations", "The new light baker uses graphics hardware to speed up lighting calculations."),
      highlight("Production workflow", "Inspect build size and time", "Build Analysis shows build times, large assets, and errors together."),
      highlight("Creative workflow", "Enter Play mode faster", "New projects skip code reloading when you press Play, reducing the wait before testing.", "Code state is not reset automatically between Play sessions."),
      highlight("Asset loading", "Load assets in smaller groups", "Content directories give teams finer control over local asset loading."),
      highlight("Editor", "Navigate large scenes", "The new Hierarchy adds customizable columns and faster scene navigation."),
      highlight("2D visuals", "Shadows that follow characters", "Animated sprites can cast shadows that follow their changing shape.", "Requires the URP 2D renderer."),
      highlight("Performance", "Find slow 2D animation", "New Profiler modules track 2D animation, tilemaps, and lighting."),
      highlight("Graphics", "Inspect rendering details", "Frame Debugger exposes more shader data to help investigate visual problems."),
      highlight("Builds", "Control shader compilation", "New compiler settings unlock newer shader features for DirectX 12."),
      highlight("Interfaces", "Keep controls clear of cutouts", "Safe-area layouts keep interfaces away from screen notches and system gestures."),
      highlight("Interfaces", "Frosted-glass backgrounds", "Background filters add blur and other effects behind interface elements."),
      highlight("Interfaces", "Soft interface shadows", "UI Toolkit adds soft shadows around interface elements."),
      highlight("Interfaces", "Shape custom interfaces", "Mesh modifiers let teams bend and reshape interface elements."),
      highlight("Visual tools", "See visual tools running", "Graph Toolkit can show active connections, live data, and errors inside a graph."),
      highlight("Project security", "Verify imported packages", "Signed Unity package files help identify who published imported content.")
    ]),
  guide("6.5", "update", "2026-06-15", "2D lights, physics, and mobile effects.",
    "2D teams and technical artists interested in more control over lighting, sprites, and effects.",
    "https://discussions.unity.com/t/unity-6-5-is-now-available/1723176", [
      highlight("Visual quality", "Custom 2D lights and shadows", "Custom 2D lights and shadows give artists more control over a scene.", "Requires the URP 2D renderer."),
      highlight("Performance", "Measure 2D performance", "The updated Profiler shows sprite counts and the sprite atlases in use."),
      highlight("2D worlds", "Simulate more 2D objects", "New physics and sprite tools can simulate and display thousands of moving 2D objects.", "Requires custom code using Physics Core 2D and RenderSprite."),
      highlight("Mobile visuals", "More efficient mobile effects", "Tile-Only rendering reduces memory traffic for supported mobile effects."),
      highlight("2D workflow", "Update tilemaps faster", "New tile identifiers reduce the work needed to set tiles on a map."),
      highlight("2D animation", "More expressive sprites", "Sprite blend shapes add new ways to deform and animate 2D characters.", "Requires custom code using the sprite blend-shape API."),
      highlight("Materials", "Reuse shader logic", "Shader Graph improvements make reusable material effects easier to organize."),
      highlight("Lighting", "Find lighting settings together", "Lighting Search brings lighting objects and settings into one searchable view."),
      highlight("Visual tools", "Customize visual tools", "Graph Toolkit adds more control over the look and behavior of custom editors."),
      highlight("Android", "Optimize Android builds", "New build optimizations can reduce startup time and processor work."),
      highlight("Learning", "Find package examples", "A dedicated Samples view makes installed package examples easier to find.")
    ]),
  guide("6.4", "update", "2026-03-17", "Project checks, console performance, and matchmaking.",
    "Teams investing in project health, console performance, or faster asset loading.",
    "https://discussions.unity.com/t/unity-6-4-is-now-available/1713245", [
      highlight("Project health", "Built-in project checks", "Project Auditor is now included in the Editor."),
      highlight("Project health", "Unsigned package warnings", "New prompts flag unsigned packages and packages from outside Unity."),
      highlight("Performance", "Console quality scaling", "Adaptive Performance expands its basic provider to PlayStation and Xbox platforms."),
      highlight("Multiplayer", "Matchmaking reports", "New Matchmaker reports explain why players have not found a match.", "Requires the separate Unity Matchmaker service."),
      highlight("Large worlds", "ECS included in the Editor", "Tools for simulating large numbers of objects now come with the Editor.")
    ]),
  guide("6.3", "lts", "2025-12-04", "Platform tools, performance reports, and 2D improvements.",
    "Teams preparing to settle on a version for production or maintain a live game.",
    "https://unity.com/blog/unity-6-3-lts-is-now-available", [
      highlight("Audience reach", "Accounts, saves, and achievements", "Platform Toolkit provides shared workflows for accounts, saved games, and achievements."),
      highlight("Performance", "Clearer performance reports", "Profiler highlights help teams identify where to investigate performance."),
      highlight("2D production", "Find unused texture space", "Sprite Atlas Analyzer reports packing and texture inefficiencies."),
      highlight("Visual quality", "More efficient mobile effects", "Rendering improvements offer more efficient post-processing for mobile and untethered XR."),
      highlight("Builds", "Reduce shader build work", "Shader build settings help teams control which shader variants get compiled."),
      highlight("Networking", "HTTP/2 connections", "HTTP/2 support lets games use newer web-server connections."),
      highlight("World building", "Create terrain materials visually", "Shader Graph brings visual material editing to terrain."),
      highlight("Interfaces", "Sharp icons at any size", "Native SVG support keeps UI Toolkit vector graphics sharp when resized.")
    ], "2027-12", "2028-12"),
  guide("6.2", "update", "2025-08-12", "Model detail, 3D interfaces, Android XR, and AI tools.",
    "Teams exploring XR experiences or reducing the work involved in preparing detailed 3D assets.",
    "https://discussions.unity.com/t/6-2-is-now-available/1677060", [
      highlight("Art workflow", "Simplify 3D models", "Mesh LOD can generate simpler versions of models during import."),
      highlight("Interaction", "Interfaces in 3D scenes", "UI Toolkit can place interfaces directly inside 3D scenes."),
      highlight("Audience reach", "Verified Android XR support", "Android XR offers verified support with improved display handling."),
      highlight("Optional tools", "AI assistance (beta)", "Optional Unity AI tools help with questions and content tasks.", "Beta at launch; installed separately."),
      highlight("Visual tools", "Create custom visual editors", "Graph Toolkit provides a starting point for building node-based tools.", "Experimental at launch; installed separately."),
      highlight("Game health", "Investigate crashes and freezes", "Dashboard reports show crashes and Android freezes affecting players."),
      highlight("Data controls", "Manage data sharing", "Dashboard settings give teams control over how their developer data is used.")
    ]),
  guide("6.1", "update", "2025-04-24", "Rendering, water, project checks, and browser graphics.",
    "Teams evaluating richer scenes, broader device reach, and earlier performance checks.",
    "https://unity.com/blog/unity-6-1-is-now-available", [
      highlight("Visual quality", "More lights and objects", "Deferred+ expands rendering options for scenes with more lights and objects.", "Requires the Universal Render Pipeline (URP)."),
      highlight("Project health", "Project checks", "Project Auditor helps inspect code, assets, settings, and builds.", "Installed as a separate package in Unity 6.1."),
      highlight("Visual quality", "Rolling waves", "Water deformation adds rolling waves to high-end scenes.", "Requires the High Definition Render Pipeline (HDRP)."),
      highlight("Web experiences", "WebGPU browser graphics", "Experimental WebGPU support brings newer graphics capabilities to browsers.", "Experimental in this release; requires a WebGPU-compatible browser."),
      highlight("Graphics", "Focus graphics work where it matters", "Variable Rate Shading reduces detail in selected areas to save rendering work.", "Requires compatible graphics hardware."),
      highlight("Publishing", "Set quality per build", "Build profiles can override quality settings for different target devices.")
    ]),
  guide("6.0", "lts", "2024-10-17", "Rendering, lighting, multiplayer, and publishing tools.",
    "Readers understanding the move from earlier Unity generations to the Unity 6 family.",
    "https://unity.com/blog/unity-6-features-announcement", [
      highlight("Performance", "Reduce processor workload", "New rendering workflows can reduce some work on the main processor."),
      highlight("Visual quality", "More lighting control", "Updated lighting tools offer more ways to shape the look of a scene."),
      highlight("Multiplayer", "Multiplayer tools", "Multiplayer tools bring setup and testing workflows together."),
      highlight("Publishing", "Shared build profiles", "Save and share build settings for each target platform."),
      highlight("Multiplayer", "Share simulation between players", "Distributed authority lets connected players share responsibility for the game simulation.", "Beta at launch."),
      highlight("Runtime AI", "Run AI models in your game", "Sentis runs AI models on players’ devices for interactive gameplay."),
      highlight("Performance", "See where memory goes", "Memory Profiler helps teams find what uses memory in their game."),
      highlight("Interfaces", "Build interfaces visually", "UI Builder improvements make interface layout and styling easier to inspect.")
    ], "2026-10", "2027-10")
];

export function findReleaseGuide(slug: string) { return RELEASE_GUIDES.find(g => g.slug === slug); }
export function guideHref(guide: ReleaseGuide) { return `/whats-new/${guide.slug}`; }
export function guideNotesHref(guide: ReleaseGuide) {
  return `/explorer?minorLine=6000.${guide.version.split(".")[1]}`;
}
export type GuideStatus = { label: "Supported now" | "Superseded" | "Standard support ended" | "Check current support" | "Upcoming"; detail: string; active: boolean };
export function guideStatus(guide: ReleaseGuide, now = new Date()): GuideStatus {
  const today = now.toISOString().slice(0, 10);
  if (today < guide.released) return { label: "Upcoming", detail: "This release has not launched yet.", active: false };
  if (guide.kind === "lts" && guide.supportThrough) {
    const ended = today.slice(0, 7) > guide.supportThrough;
    return { label: ended ? "Standard support ended" : "Supported now", active: !ended,
      detail: `Standard support through ${supportMonth(guide.supportThrough)}. Enterprise and Industry support through ${supportMonth(guide.extendedThrough!)}.` };
  }
  const successor = RELEASE_GUIDES.find(g => g.released > guide.released && g.released <= today);
  if (successor) return { label: "Superseded", active: false, detail: "This Update release has been replaced. Its regular support window has ended." };
  if (now.getTime() - Date.parse(guide.reviewed + "T00:00:00Z") > 30 * 86_400_000) {
    return { label: "Check current support", active: false, detail: "Our support check is over 30 days old. Confirm the current release with Unity before choosing it." };
  }
  return { label: "Supported now", active: true, detail: "Supported until the next release replaces it. Plan for a more frequent upgrade cycle." };
}
export function supportMonth(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value + "-01T00:00:00Z"));
}

/** Editorial launch dates are calendar days, not local timestamps. */
export function formatGuideDate(day: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(day + "T00:00:00Z"));
}
