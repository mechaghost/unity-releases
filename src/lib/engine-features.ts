import type { ReleaseFeature } from "./release-features";
import type { ReleaseGuide } from "./release-guides";
import { unity6Features } from "./unity6-features";

export const ENGINE_FEATURES_PATH = "/whats-new/by-feature";

type FeatureId = `${number}-${number}`;

export type EngineFeatureArticle = {
  title: string;
  description: string;
  source: "Unity Blog" | "Unity Discussions" | "Unity Learn" | "Unity Manual" | "Unity Release Notes" | "Unity Resources";
  href: string;
};

type EngineFeatureArea = {
  slug: string;
  name: string;
  description: string;
  cover: FeatureId;
  features: readonly FeatureId[];
  articles: Partial<Record<string, readonly EngineFeatureArticle[]>>;
};

// Feature IDs are the existing release/index keys shared by each highlight, image, and detail page.
export const ENGINE_FEATURE_AREAS: readonly EngineFeatureArea[] = [
  {
    slug: "3d",
    name: "3D",
    description: "Rendering, lighting, meshes, terrain, and tools for large scenes.",
    cover: "6.3-6",
    features: ["6.6-1", "6.6-5", "6.6-8", "6.5-6", "6.5-7", "6.4-4", "6.3-6", "6.2-0", "6.2-1", "6.1-0", "6.1-2", "6.1-4", "6.0-0", "6.0-1"],
    articles: {
      "6.6": [{
        title: "Inside the Unity Compute Light Baker",
        description: "The graphics team explains how the new baker generates lightmaps and probe data.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/new-unity-compute-light-baker-available-in-6-6/1734762"
      }],
      "6.5": [{
        title: "Shader Graph subgraph improvements",
        description: "See new input controls for colors, sliders, and options on reusable shader nodes.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/shader-subgraph-improvements-in-unity-6-5/1705859"
      }],
      "6.0": [{
        title: "New ways to light 3D scenes in Unity 6",
        description: "See how Adaptive Probe Volumes handle probe placement and changing lighting conditions.",
        source: "Unity Blog",
        href: "https://unity.com/blog/engine-platform/new-ways-of-applying-global-illumination-in-unity-6"
      }, {
        title: "Try the Unity 6 rendering tools",
        description: "Configure GPU-driven rendering and bake a scene with Adaptive Probe Volumes.",
        source: "Unity Learn",
        href: "https://learn.unity.com/course/unity-6-new-rendering-features?version=6.0"
      }]
    }
  },
  {
    slug: "2d",
    name: "2D",
    description: "Sprites, lighting, animation, tilemaps, and 2D physics.",
    cover: "6.6-0",
    features: ["6.6-0", "6.6-6", "6.6-7", "6.5-0", "6.5-1", "6.5-2", "6.5-4", "6.5-5", "6.3-2"],
    articles: {
      "6.6": [{
        title: "2D lighting and profiling in Unity 6.6",
        description: "See Bunny Blitz with separate lighting layers, plus examples of skinned shadows and the new Profiler modules.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/unity-6-6-is-now-available/1735357"
      }],
      "6.5": [{
        title: "How to light a 2D scene in URP",
        description: "Work with light types, sprite materials, and shadows, including the custom light API in 6.5.",
        source: "Unity Manual",
        href: "https://docs.unity.com/en-us/engine/6000.5/manual/unity2d/2d-urp/2d-index"
      }],
      "6.4": [{
        title: "Build sprite atlases at runtime",
        description: "Unity’s 2D team explains runtime atlases in 6.4 and shares common atlas setup mistakes.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/2d-sprite-atlas-best-practices-guide-and-video-tutorial/1710036"
      }],
      "6.3": [{
        title: "Get started with the Sprite Atlas Analyzer",
        description: "Find empty space, extra atlas pages, and textures that could be compressed twice.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/sprite-atlas-analyzer-in-unity-6-3/1683242"
      }]
    }
  },
  {
    slug: "multiplayer",
    name: "Multiplayer",
    description: "Netcode, matchmaking, testing, and project templates for online games.",
    cover: "6.0-4",
    features: ["6.4-3", "6.0-2", "6.0-4"],
    articles: {
      "6.6": [{
        title: "Multiplayer Play Mode fixes in Unity 6.6",
        description: "Unity fixed errors when opening test instances and made cloned Editors follow the main Editor’s Hierarchy setting.",
        source: "Unity Release Notes",
        href: "https://unity.com/releases/editor/whats-new/6000.6.0f1"
      }],
      "6.5": [{
        title: "Test stateful Cloud Code and a local server",
        description: "Experimental packages let teams keep state across calls and test server logic locally.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/new-cloud-code-features-to-develop-deploy-and-grow-your-games/1718489"
      }],
      "6.4": [{
        title: "Debug matchmaking from the dashboard",
        description: "Unity’s release post covers ticket logs, pool and filter rules, and configuration history.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/unity-6-4-is-now-available/1713245"
      }],
      "6.3": [{
        title: "Start with a multiplayer template in Unity Hub",
        description: "Try the first-person shooter or third-person gameplay template for Unity 6.3 and later.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/unity-6-3-new-multiplayer-templates-available-in-the-hub/1700722"
      }, {
        title: "Play Mode Scenarios move into the Editor",
        description: "The Multiplayer Play Mode team explains the move into Unity 6.3 and what it means for earlier releases.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/multiplayer-play-mode-1-6-0-and-roadmap-update/1680660"
      }],
      "6.0": [{
        title: "Build and test a multiplayer scene",
        description: "Set up a basic Netcode for GameObjects scene and simulate players with Multiplayer Play Mode.",
        source: "Unity Learn",
        href: "https://learn.unity.com/course/unity-6-multiplayer-creation?version=6"
      }, {
        title: "Explore the Megacity Metro multiplayer demo",
        description: "Unity’s launch post links to a sample with networked vehicles and rule-based matches.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/simplify-multiplayer-game-creation/1529805"
      }]
    }
  },
  {
    slug: "platforms",
    name: "Platforms",
    description: "Build and ship for mobile, web, console, desktop, and XR.",
    cover: "6.2-2",
    features: ["6.6-2", "6.6-9", "6.6-10", "6.5-3", "6.5-9", "6.4-2", "6.3-0", "6.3-3", "6.3-4", "6.2-2", "6.1-3", "6.1-5", "6.0-3"],
    articles: {
      "6.6": [{
        title: "WebGPU becomes a supported option for web builds",
        description: "See how to enable it, keep a WebGL 2 fallback, and try two Unity demos in your browser.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/webgpu-out-of-experimental-in-unity-6-6/1734694"
      }],
      "6.5": [{
        title: "Android build optimization and its trade-offs",
        description: "Unity’s Android team covers setup, startup measurements, build times, and app-size changes.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/boosting-android-performance-with-lto-optimizations-in-unity-6-5/1720008"
      }],
      "6.3": [{
        title: "Native screen readers on Windows and macOS",
        description: "Unity explains desktop screen reader support and links to the accessibility APIs.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/native-desktop-screen-reader-support-now-available-in-unity-6-3/1681788"
      }],
      "6.0": [{
        title: "Mobile game optimization in Unity 6",
        description: "Watch Unity demonstrate rendering and lighting optimizations for Android and iOS.",
        source: "Unity Resources",
        href: "https://unity.com/resources/mobile-game-optimization-in-unity-6"
      }]
    }
  },
  {
    slug: "ui-accessibility",
    name: "UI & Accessibility",
    description: "UI Toolkit, uGUI, text rendering, and screen reader support.",
    cover: "6.6-11",
    features: ["6.6-10", "6.6-11", "6.6-12", "6.6-13", "6.3-7", "6.2-1", "6.0-7"],
    articles: {
      "6.6": [{
        title: "New UI Toolkit effects and uGUI safe areas",
        description: "See examples of backdrop blur, drop shadows, and layouts that avoid display cutouts.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/unity-6-6-is-now-available/1735357"
      }],
      "6.5": [{
        title: "Advanced Text Generator becomes the default",
        description: "Unity’s UI team explains the switch for runtime panels, font support, and how to migrate existing font assets.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/advanced-text-generator-atg-now-default-in-6-5/1715871"
      }],
      "6.3": [{
        title: "Native screen readers on Windows and macOS",
        description: "Add support for Narrator and VoiceOver with Unity’s accessibility APIs.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/native-desktop-screen-reader-support-now-available-in-unity-6-3/1681788"
      }, {
        title: "UI Toolkit styling and testing in Unity 6.3",
        description: "Unity’s UI team covers custom shaders, styling controls, and how test fixtures simulate user interactions.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/ui-toolkit-development-status-and-next-milestones-november-2025/1698009"
      }],
      "6.2": [{
        title: "Put a UI Toolkit panel in a 3D scene",
        description: "Follow Unity’s 6.2 setup for positioning and interacting with a world-space panel.",
        source: "Unity Manual",
        href: "https://docs.unity3d.com/6000.2/Documentation/Manual/ui-systems/create-world-space-ui.html"
      }],
      "6.0": [{
        title: "Build custom controls with data binding",
        description: "Use the Unity Learn sample project to make a UI Toolkit control update as its data changes.",
        source: "Unity Learn",
        href: "https://learn.unity.com/tutorial/67938e4aedbc2a3600fbb84c"
      }, {
        title: "Support screen readers on Android and iOS",
        description: "See how to expose your game’s interface to TalkBack and VoiceOver and respect system text settings.",
        source: "Unity Manual",
        href: "https://docs.unity.com/en-us/engine/6000.0/manual/platform-specific/cross-platform-features/mobile-accessibility"
      }]
    }
  },
  {
    slug: "editor-workflow",
    name: "Editor & Workflow",
    description: "Play Mode, the Hierarchy, build reports, asset packaging, and Editor tools.",
    cover: "6.6-5",
    features: ["6.6-2", "6.6-3", "6.6-4", "6.6-5", "6.6-14", "6.6-15", "6.5-8", "6.5-10", "6.4-0", "6.4-1", "6.3-4", "6.2-4", "6.1-1", "6.1-5", "6.0-3"],
    articles: {
      "6.6": [{
        title: "Get started with content directories",
        description: "Unity’s asset team walks through building and loading a first content directory.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/getting-started-with-content-directories/1740417"
      }, {
        title: "Read a build report in Build Analysis",
        description: "Find build times, asset sizes, and the files Unity produced in the new Editor window.",
        source: "Unity Manual",
        href: "https://docs.unity.com/en-us/engine/6000.6/manual/building-and-publishing/build-analyze-builds/build-analysis-window-reference"
      }],
      "6.5": [{
        title: "Check for obsolete APIs before upgrading",
        description: "Unity explains how Project Auditor can flag calls your project will need to update in a later Editor version.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/project-auditor-helping-you-to-upgrade-your-unity-version/1716833"
      }],
      "6.4": [{
        title: "Run Project Auditor from the Editor",
        description: "The 6.4 announcement explains where to find the built-in tool and how Unity ships updates to its rules.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/unity-6-4-is-now-available/1713245"
      }],
      "6.2": [{
        title: "Build a custom graph with Graph Toolkit",
        description: "See what the experimental package offered at launch and where to find the included samples.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/unity-s-graph-toolkit-experimental-available-today-in-unity-6-2/1664909"
      }],
      "6.0": [{
        title: "Set up Build Profiles for your team",
        description: "Create separate profiles for development and release builds, with their own scenes and settings.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/what-you-need-to-know-about-build-profiles-in-unity-6/1605803"
      }]
    }
  },
  {
    slug: "scripting-ecs",
    name: "Scripting & ECS",
    description: "C# runtime changes, the Burst compiler, and Unity’s Entity Component System.",
    cover: "6.4-4",
    features: ["6.6-3", "6.6-5", "6.5-4", "6.4-4", "6.3-5"],
    articles: {
      "6.6": [{
        title: "Burst moves into the engine",
        description: "See how built-in Burst affects package references, including projects with local or embedded copies.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/the-future-of-burst-in-unity-6-6/1712615"
      }, {
        title: "Prepare scripts for the move to CoreCLR",
        description: "Unity’s scripting team explains the 6.6 changes to Play Mode and static state, and outlines future CoreCLR work.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/coreclr-scripting-and-serialization-update-june-2026/1723299"
      }, {
        title: "Using Entities in the new Hierarchy",
        description: "See GameObjects, Worlds, and runtime Entities in one view and inspect update order in the Systems window.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/ecs-development-status-for-unity-6-6/1724480"
      }],
      "6.5": [{
        title: "Move from InstanceID to EntityId",
        description: "Unity’s upgrade notes explain the new identifier type and which code needs to change.",
        source: "Unity Manual",
        href: "https://docs.unity.com/en-us/engine/6000.6/manual/upgrade-guides/upgrade-guide-unity65"
      }],
      "6.4": [{
        title: "Entities and related packages ship with the Editor",
        description: "Unity explains why Entities, Collections, Mathematics, and Entities Graphics moved into the core release.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/unity-6-4-is-now-available/1713245"
      }],
      "6.2": [{
        title: "Entities 1.4 and experimental Unity Vehicles",
        description: "The 6.2 manual links to the Entities changes and introduces the ECS-compatible vehicle controller.",
        source: "Unity Manual",
        href: "https://docs.unity.com/en-us/engine/6000.5/manual/whats-new/unity62#entities-1"
      }],
      "6.0": [{
        title: "Get started with data-oriented systems in Unity 6",
        description: "Read Unity’s introduction to ECS, Jobs, and Burst, with samples to try in a project.",
        source: "Unity Resources",
        href: "https://unity.com/resources/dots-concepts-features-samples-resources-unity-6?isGated=false"
      }]
    }
  },
  {
    slug: "performance-profiling",
    name: "Performance & Profiling",
    description: "Find slow frames, memory growth, build bottlenecks, and crashes.",
    cover: "6.3-1",
    features: ["6.6-2", "6.6-7", "6.6-8", "6.5-1", "6.4-0", "6.4-2", "6.3-1", "6.3-2", "6.2-5", "6.1-1", "6.0-0", "6.0-6"],
    articles: {
      "6.6": [{
        title: "Measure GPU Resident Drawer activity",
        description: "Unity’s 6.6 guide shows what the new Profiler view reports about coverage, culling, and timing.",
        source: "Unity Manual",
        href: "https://docs.unity.com/en-us/engine/6000.6/manual/whats-new/unity66#gpu-resident-drawer-activity-in-the-profiler"
      }],
      "6.5": [{
        title: "Track sprite counts and atlas use in the Profiler",
        description: "Find where the new 2D module reports sprites and which atlases were used in a frame.",
        source: "Unity Manual",
        href: "https://docs.unity.com/en-us/engine/6000.5/manual/unity2d/sprite/profiler-2d"
      }],
      "6.3": [{
        title: "Read the Highlights Profiler module",
        description: "Use the overview to find expensive frames and see whether the CPU or GPU is taking longer.",
        source: "Unity Manual",
        href: "https://docs.unity.com/en-us/engine/6000.3/manual/analysis/profiler/visualizing-data/highlights"
      }],
      "6.2": [{
        title: "Investigate crashes and Android freezes in Unity Diagnostics",
        description: "Unity’s team explains the new Dashboard reports, including app-not-responding events and session details.",
        source: "Unity Discussions",
        href: "https://discussions.unity.com/t/deprecation-of-legacy-cloud-diagnostics-transition-to-new-diagnostics/1677370"
      }],
      "6.1": [{
        title: "Unity’s profiling handbook for Unity 6",
        description: "Learn when to capture, which profiling tool to use, and how to check memory and power use on target devices.",
        source: "Unity Resources",
        href: "https://unity.com/resources/ultimate-guide-to-profiling-unity-games-unity-6"
      }],
      "6.0": [{
        title: "Compare memory snapshots from a running build",
        description: "Follow Unity’s walkthrough to find large allocations and check whether memory grows across scenes.",
        source: "Unity Resources",
        href: "https://unity.com/how-to/analyze-memory-usage-memory-profiling-tools"
      }]
    }
  }
];

export function engineFeatureHref(area: EngineFeatureArea) {
  return `${ENGINE_FEATURES_PATH}/${area.slug}`;
}

export function findEngineFeatureArea(slug: string) {
  return ENGINE_FEATURE_AREAS.find(area => area.slug === slug);
}

export function engineFeatureReleases(area: EngineFeatureArea, now = new Date()) {
  const groups = new Map<string, { guide: ReleaseGuide; features: ReleaseFeature[]; articles: readonly EngineFeatureArticle[] }>();
  const featureIds = new Set<string>(area.features);
  for (const { guide, feature } of unity6Features(now)) {
    let group = groups.get(guide.version);
    if (!group) {
      group = { guide, features: [], articles: area.articles[guide.version] ?? [] };
      groups.set(guide.version, group);
    }
    if (featureIds.has(feature.id)) group.features.push(feature);
  }
  return [...groups.values()].filter(group => group.features.length || group.articles.length);
}
