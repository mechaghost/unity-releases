/** Reviewed editorial content. Keep launch highlights separate from later patches.
 * See docs/release-guides.md before adding a release or changing support dates. */
export type GuideHighlight = { category: string; title: string; benefit: string; consideration: string };
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
const highlight = (category: string, title: string, benefit: string, consideration: string): GuideHighlight =>
  ({ category, title, benefit, consideration });
const guide = (version: string, kind: ReleaseGuide["kind"], released: string, summary: string, audience: string,
  source: string, highlights: GuideHighlight[], supportThrough?: string, extendedThrough?: string): ReleaseGuide =>
  ({ version, slug: `unity-${version.replace(".", "-")}`, kind, released, reviewed: "2026-10-24", summary, audience, source, highlights, supportThrough, extendedThrough });

export const RELEASE_GUIDES: readonly ReleaseGuide[] = [
  guide("6.6", "update", "2026-09-01", "Less waiting while testing, clearer build reports, and more flexible local content.",
    "Teams looking to shorten everyday development loops and understand what makes their game large or slow to build.",
    "https://discussions.unity.com/t/unity-6-6-is-now-available/1735357", [
      highlight("Production workflow", "Get back to testing sooner", "New projects enter Play mode without reloading code by default.", "Existing code may need changes to reset its state correctly between tests."),
      highlight("Content management", "Load only the local content you need", "Content directories offer finer control over local asset loading.", "This is a local-content workflow. Remote content can still use AssetBundles."),
      highlight("Production workflow", "Understand build size and delays", "Build Analysis brings build history, large assets, and failure details into one place.", "A report helps locate a problem; teams still need to investigate and fix it."),
      highlight("Editor usability", "Navigate large scenes more easily", "The new Hierarchy window is enabled by default, with configurable columns.", "Check custom Editor tools when adopting the new window.")
    ]),
  guide("6.5", "update", "2026-06-15", "More expressive 2D art tools and clearer ways to investigate graphics performance.",
    "2D teams and technical artists interested in more control over lighting, sprites, and effects.",
    "https://discussions.unity.com/t/unity-6-5-is-now-available/1723176", [
      highlight("Visual quality", "Shape the look of 2D worlds", "Custom 2D lights and shadows give artists more control over a scene.", "These capabilities need an appropriate 2D rendering setup."),
      highlight("Performance", "See where 2D rendering work goes", "The updated Profiler shows sprite counts and the sprite atlases in use.", "Measurements guide optimization; they do not improve performance automatically."),
      highlight("Creative workflow", "Start effects from a useful template", "Contextual graph templates make it easier to begin decal and fullscreen effects.", "Technical art work is still needed to fit the effect to the project."),
      highlight("Performance", "Investigate graphics stutter", "Improved tracing and caching tools help teams find missing precompiled graphics work.", "Teams must test the resulting cache on their target hardware.")
    ]),
  guide("6.4", "update", "2026-03-17", "Built-in project checks, clearer package warnings, and expanded performance tools.",
    "Teams investing in project health, console performance, or faster asset loading.",
    "https://discussions.unity.com/t/unity-6-4-is-now-available/1713245", [
      highlight("Project health", "Project checks are ready to use", "Project Auditor is included in the Editor rather than needing a separate installation.", "Findings still need a developer to assess their relevance."),
      highlight("Project health", "Make informed package choices", "New prompts call attention to unsigned packages and packages from outside Unity.", "A prompt is information to review, not a guarantee about package safety."),
      highlight("Performance", "Adapt quality on more consoles", "Adaptive Performance expands its basic provider to PlayStation and Xbox platforms.", "Quality scaling needs tuning and device testing."),
      highlight("Loading", "Use fast storage more effectively", "DirectStorage supports loading textures, meshes, and ECS data on PC and Xbox.", "Benefits depend on storage hardware and the project's content workflow.")
    ]),
  guide("6.3", "lts", "2025-12-04", "A longer support window with improvements to platform integration, 2D tools, and performance analysis.",
    "Teams preparing to settle on a version for production or maintain a live game.",
    "https://unity.com/blog/unity-6-3-lts-is-now-available", [
      highlight("Audience reach", "Connect common platform features", "Platform Toolkit provides shared workflows for accounts, saved games, and achievements.", "Platform access and certification requirements still apply."),
      highlight("Performance", "Make performance reports easier to read", "Profiler highlights offer an accessible starting point for investigating performance.", "A developer should validate the cause on representative devices."),
      highlight("2D production", "Find wasted texture space", "Sprite Atlas Analyzer reports packing and texture inefficiencies.", "Teams decide which changes suit their visual quality and memory budget."),
      highlight("Visual quality", "More options for mobile effects", "Rendering improvements offer more efficient post-processing for mobile and untethered XR.", "Gains depend on the effects, graphics pipeline, and hardware.")
    ], "2027-12", "2028-12"),
  guide("6.2", "update", "2025-08-12", "More tools for detailed worlds, spatial interfaces, and Android XR experiences.",
    "Teams exploring XR experiences or reducing the work involved in preparing detailed 3D assets.",
    "https://discussions.unity.com/t/6-2-is-now-available/1677060", [
      highlight("Art workflow", "Prepare different levels of detail", "Mesh LOD can generate simpler versions of models during import.", "Artists should review the results for visible quality changes."),
      highlight("Interaction", "Put interfaces inside the world", "UI Toolkit gains world-space interfaces for games and immersive experiences.", "Interaction and readability need testing at the intended viewing distances."),
      highlight("Audience reach", "Build on verified Android XR support", "The Android XR package reaches verified status with additions for hands and display behavior.", "Hardware and package requirements still need checking."),
      highlight("Optional tools", "Explore AI assistance", "Unity AI launched in beta alongside this release for assistance and content tasks.", "Beta at launch; optional installation. Check current pricing, terms, and availability separately.")
    ]),
  guide("6.1", "update", "2025-04-24", "More graphics options, project analysis tools, and support for varied screen formats.",
    "Teams evaluating richer scenes, broader device reach, and earlier performance checks.",
    "https://unity.com/blog/unity-6-1-is-now-available", [
      highlight("Visual quality", "Build richer scenes", "Deferred+ expands rendering options for scenes with more lights and objects.", "Benefits depend on the graphics pipeline and scene setup."),
      highlight("Project health", "Find problems earlier", "Project Auditor helps inspect code, assets, settings, and builds.", "Available as a tool in this release; built-in inclusion arrived later in 6.4."),
      highlight("Audience reach", "Support more screen formats", "Android improvements extend support for large screens and foldable devices.", "Layouts still need design and testing for each form factor."),
      highlight("Web experiences", "Explore newer browser graphics", "Experimental WebGPU integration opens another path for browser graphics.", "Experimental at launch. Check browser coverage and test a fallback before relying on it.")
    ]),
  guide("6.0", "lts", "2024-10-17", "The foundation of Unity 6: updated graphics, multiplayer workflows, and mobile web reach.",
    "Readers understanding the move from earlier Unity generations to the Unity 6 family.",
    "https://unity.com/blog/unity-6-features-announcement", [
      highlight("Performance", "Give graphics hardware more of the work", "New rendering workflows can reduce some work on the main processor.", "The benefit depends on the scene, graphics setup, and target device."),
      highlight("Visual quality", "Expand lighting options", "Updated lighting tools offer more ways to shape the look of a scene.", "Visual upgrades need an art and performance budget."),
      highlight("Multiplayer", "Connect multiplayer development steps", "Updated workflows bring more parts of creating connected games together.", "Online services can have separate setup, operating costs, and terms."),
      highlight("Audience reach", "Bring experiences to mobile browsers", "Improved mobile web support broadens browser delivery options.", "Browser memory, input, and device constraints still require testing.")
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
