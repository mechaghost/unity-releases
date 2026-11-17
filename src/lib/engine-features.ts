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
    cover: "6.4-4",
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
