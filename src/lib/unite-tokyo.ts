import type { GuideImage } from "./release-guides";
import type { EventDemo, EventLink, EventSection, UniteEvent } from "./unite-events";
import { UNITE_TOKYO_PATH } from "./unite-event-paths";

const UNITE_TOKYO_DATE = "2026-11-17";
const UNITE_TOKYO_REVIEWED = "2026-11-21";

const unity = "https://unity.com";
const docs = "https://docs.unity.com/en-us";
const discussions = "https://discussions.unity.com/t";
const keynoteRecap = `${unity}/blog/unite-tokyo-2026-keynote-recap`;
const atrioSample = "https://assetstore.unity.com/packages/3d/environments/atrio-3d-stylized-sample-project-426254";
const bunnyBlitzSample = "https://assetstore.unity.com/packages/templates/packs/bunny-blitz-2d-physics-core-sample-project-426130";
const roadmapSlides = "https://cdn.bfldr.com/S5BC9Y64/at/k7crmvj3rg9z7c8w9m9tbmvs/Unite_2026_Tokyo_-_Roadmap_Final.pdf";
const slides = (page: number) => [`Tokyo roadmap slides (PDF, page ${page})`, `${roadmapSlides}#page=${page}`] as const;

const UNITE_TOKYO_RECORDINGS: EventLink[] = [
  ["Watch the keynote", "https://www.youtube.com/watch?v=ZWX5TfR1UAI"],
  ["Watch the roadmap session", "https://www.youtube.com/watch?v=gJV4fZ7dpQw"]
];

const UNITE_TOKYO_KEYNOTE_IMAGE: GuideImage = {
  src: "/images/unite-tokyo-2026/keynote.webp",
  alt: "Adam Smith speaking on the Unite Tokyo stage in front of a blue screen",
  width: 1200,
  height: 800,
  original: "https://cdn.sanity.io/images/fuvbjjlp/production/0418bb71e2d7269fe2b479d4ef1d21771d3f8b7a-4032x2688.jpg",
  source: keynoteRecap
};

const UNITE_TOKYO_GRAPHICS_DEMOS: EventDemo[] = [
  {
    image: {
      src: "/images/unite-tokyo-2026/atrio.webp",
      alt: "Sunlit courtyard with stone arches and climbing plants in Unity’s Atrio sample",
      width: 960,
      height: 640,
      original: "https://assetstorev1-prd-cdn.unity3d.com/key-image/a126be60-befa-4f24-9602-f53c4d08cf92.jpg?v=1",
      source: atrioSample
    },
    video: ["Watch the Atrio lighting demo", "https://www.youtube.com/watch?v=QfXsGwrBgVg"],
    credit: "Atrio on the Asset Store"
  },
  {
    image: {
      src: "/images/unite-tokyo-2026/bunny-blitz.webp",
      alt: "The Bunny Blitz Physics rabbit holds a lit bomb in a stylized stone chamber",
      width: 960,
      height: 640,
      original: "https://assetstorev1-prd-cdn.unity3d.com/key-image/3842ba2a-3496-411e-81c8-87b48dad5a10.jpg?v=1",
      source: bunnyBlitzSample
    },
    video: ["Watch Unity’s 2D feature demo", "https://www.youtube.com/watch?v=MKs5XZl5G9Y"],
    credit: "Bunny Blitz Physics on the Asset Store"
  }
];

const UNITE_TOKYO_SOURCES: EventLink[] = [
  ["Keynote recap", keynoteRecap],
  ["Keynote recap in Japanese", `${unity}/ja/blog/unite-tokyo-2026-keynote-recap`],
  ["Unity roadmap", `${unity}/roadmap`],
  ["Download the roadmap slides (PDF)", roadmapSlides],
  ["Unity Japan session schedule and slides", "https://unitetokyo.com/session/"]
];

const UNITE_TOKYO_SECTIONS: EventSection[] = [
  {
    id: "editor",
    title: "Editor and engine",
    topics: [
      {
        title: "Unity 6.7 LTS and Unity 7",
        status: "6.7 beta · 7.0 alpha",
        summary: "Unity targets late 2026 for 6.7 LTS and early 2027 for Unity 7. Unity 6.7 is in beta and Unity 7 is in alpha. Unity plans an upgrade similar to a Unity 6 update, with specific breaking changes to check before moving.",
        links: [
          ["Search 6.7 release notes", "/explorer?minorLine=6000.7"],
          ["Search 7.0 release notes", "/explorer?minorLine=7000.0"],
          ["Unity 6.7 beta manual", `${docs}/engine/6000.7/manual`],
          ["Unity 7 alpha manual", `${docs}/engine/7000.0/manual`],
          ["Unity 6.7 beta downloads", `${unity}/releases/editor/beta`],
          ["Unity 7 alpha downloads", `${unity}/releases/editor/alpha`],
          ["Unity 7 release page", `${unity}/releases/unity-7`],
          ["Planned Unity 7.0 breaking changes", `${discussions}/planned-breaking-changes-in-unity-7-0/1740094`]
        ]
      },
      {
        title: "CoreCLR and the upgrade path",
        summary: "Unity 6.7 offers experimental desktop CoreCLR and iOS IL2CPP player options. Unity 7 plans CoreCLR in the Editor, .NET 10, C# 14, and MSBuild project compilation. Unity showed Project Auditor upgrades for 7.0, CoreCLR, and URP. Unity plans to drop both the Intel Mac Editor and Intel Mac player targets in 7.0.",
        links: [
          ["CoreCLR status and player options", `${discussions}/coreclr-scripting-and-net-update-october-2026/1738338`],
          ["CoreCLR upgrade guide", `${discussions}/path-to-coreclr-2026-upgrade-guide/1714279`],
          ["Tokyo CoreCLR migration slides", "https://www.docswell.com/s/UnityJapan/5Q2WJW-2026-11-18-141452"],
          slides(7)
        ]
      },
      {
        title: "ECS for All",
        status: "6.7 foundation · 7.0 authoring plans",
        summary: "Unity 6.7 shares an ID between a GameObject and its Entity. Unity 7.0 plans data components on GameObjects and prefabs, with Entity data editing in the Inspector. The spaceship demo measured one workload and setup.",
        links: [["ECS for All", `${unity}/ecs`], ["Watch the ECS demo", "https://www.youtube.com/watch?v=cAYg3rYUtkQ"], ["Tokyo ECS for All session slides", "https://www.docswell.com/s/UnityJapan/57NP6J-2026-11-16-235408"]]
      },
      {
        title: "Profiling, networking, and package security",
        summary: "The roadmap showed a Web Requests Profiler for timing, errors, and bandwidth, plus a unified Netcode direction for client prediction and larger games. It also showed Unity-native cloud logic with shared state through CloudBehaviours, and project-wide package security settings.",
        links: [["Unity Core Standards update", `${discussions}/unity-core-standards-what-s-new-in-6-6-and-6-7-and-looking-ahead-to-unity-7/1740002`], slides(12), ["Multiplayer changes in Unity 6", "/whats-new/by-feature/multiplayer"]]
      },
      {
        title: "Graph tools, audio, navigation, input, and animation",
        summary: "Unity showed Graph Toolkit state machines and live debugging, audio processors and root outputs, NavWorld queries from jobs, terrain tree navigation, and Input System priority and sensor support. The animation roadmap includes a low-level C# API with Burst and ECS support, with more Animator work planned later in Unity 7.",
        links: [slides(17), ["Audio changes in Unity 6", "/whats-new/by-feature/audio"], ["Animation changes in Unity 6", "/whats-new/by-feature/animation"]]
      }
    ]
  },
  {
    id: "graphics",
    title: "Graphics, 2D, and UI",
    demos: UNITE_TOKYO_GRAPHICS_DEMOS,
    topics: [
      {
        title: "Moving to URP",
        status: "Unity 7 roadmap",
        summary: "The Built-in Render Pipeline stays supported through 6.7 LTS and is slated for removal in 7.0. Unity’s Tokyo migration session says HDRP is slated for deprecation in 7.0, with support through the first Unity 7 LTS. Unity is building more high-end features into URP.",
        links: [
          ["Migrate from Built-in to URP", `${docs}/engine/6000.7/manual/render-pipelines/universal-render-pipeline/introduction/installing-and-configuring-urp/upgrading-from-birp`],
          ["Tokyo render pipeline migration slides", "https://www.docswell.com/s/UnityJapan/KJWMRQ-2026-11-16-235814"]
        ]
      },
      {
        title: "URP lighting and the Atrio sample",
        status: "Sample available · 6.7 beta",
        summary: "Atrio shows dynamic indirect lighting with Surface Cache GI, glossy screen-space reflections, and ground-truth ambient occlusion. The Asset Store lists URP and 6000.7.0b8 for this sample. Unity also showed work on physical light units, auto exposure, sky, fog, and light falloff for Built-in migration.",
        links: [
          ["Get Atrio on the Asset Store", atrioSample],
          ["Graphics updates in the 6.7 beta", `${discussions}/graphics-updates-with-the-unity-6-7-beta-release-we-want-to-hear-your-feedback/1737140`],
          ["Tokyo URP lighting session slides", "https://www.docswell.com/s/UnityJapan/53JWYM-2026-11-16-235027"],
          slides(33)
        ]
      },
      {
        title: "Unity Graphics Kernel and Unity Neural",
        summary: "Unity’s Graphics Kernel is in early access for Vulkan in 6.7 beta and DirectX 12 in 7.0 alpha. Unity also covered Metal and showed neural inference in URP. Neural Texture Compression is experimental in 6.7 and planned for release in Unity 7. Unity measured roughly 30% lower texture memory in Atrio with the compression enabled.",
        links: [["Graphics Kernel early access and setup", `${discussions}/introducing-the-unity-graphics-kernel/1741739`], ["Watch Unity Neural", "https://www.youtube.com/watch?v=gFWJb3YVVE4"], slides(41)]
      },
      {
        title: "Upscaling and shader tools",
        summary: "Unity covered URP upscalers, including STP, DLSS, FSR, and MetalFX, plus platform and partner options. The roadmap also covers per-material stencil settings in Shader Graph, DXC and newer HLSL features, faster shader build profiles, Advanced Shader Delivery, and compute shader tracing.",
        links: [slides(39), slides(43), ["3D graphics changes in Unity 6", "/whats-new/by-feature/3d"]]
      },
      {
        title: "Physics Core 2D, rendering, and Bunny Blitz",
        status: "Sample available · 6.7 beta",
        summary: "Unity showed Pose, Area, and Constraint components for Physics Core 2D, more ways to customize the 2D renderer, and profiling for sprites, tilemaps, graphics, and physics. Bunny Blitz lists URP and 6000.7.0b9. Unity 7 plans deeper 2D physics and animation integration, faster Tilemap and SpriteShape rendering, and better 2D authoring in 3D scenes.",
        links: [
          ["Get Bunny Blitz on the Asset Store", bunnyBlitzSample],
          ["Tokyo 2D graphics session slides", "https://www.docswell.com/s/UnityJapan/ZQ2W4M-2026-11-16-235111"],
          slides(45),
          ["2D changes in Unity 6", "/whats-new/by-feature/2d"]
        ]
      },
      {
        title: "UI Toolkit, accessibility, and localization",
        summary: "Unity 6.7 highlights include Scene view authoring, keyframe animation, better Inspector support, faster selectors, and a UI Profiler. Unity also covered Advanced Text Generator, built-in localization, Smart Strings, and a unified table editor. Unity 7 previews include grid layout, reusable components, Shader Graph UI filters, UI Builder improvements, runtime screen readers, curved UI, font subsetting, TextMesh Pro text improvements, and a Figma connector.",
        links: [slides(53), ["Tokyo UI Toolkit session slides", "https://www.docswell.com/s/UnityJapan/Z8NP62-2026-11-16-234510"], ["UI and accessibility changes in Unity 6", "/whats-new/by-feature/ui-accessibility"]]
      }
    ]
  },
  {
    id: "tools",
    title: "Development and collaboration tools",
    topics: [
      {
        title: "Unity CLI and the local Pipeline package",
        status: "Stable 1.x",
        summary: "Unity presented stable CLI and com.unity.pipeline 1.0 together at Tokyo. The local package connects a running Editor to the CLI so scripts and agents can create content, run tests and builds, and call custom commands. The roadmap also covers Generators in the CLI, agent identity, and testing on devices.",
        links: [["Unity CLI guide", "/whats-new/unity-cli"], ["Unity Pipeline package guide", "/whats-new/unity-pipeline"], ["Unity’s official 1.0 announcement", `${unity}/the-unity-cli-1.0-is-here`], ["Tokyo CLI prototyping session slides", "https://www.docswell.com/s/UnityJapan/ZJWMVJ-2026-11-18-141631"]]
      },
      {
        title: "Official plug-ins for coding agents",
        status: "Setup docs available",
        summary: "Unity publishes setup instructions for Claude Code, Codex, Google Antigravity, and Grok. The plug-ins bundle Unity-authored skills and connect agent workflows to Unity tools.",
        links: [["Unity plug-in installation docs", `${docs}/ai/unity-plugin`], ["Agentic Coding with Unity guide", "/guides/agentic-coding-with-unity"]]
      },
      {
        title: "Hosted Unity Production Pipeline API",
        status: "Beta · general availability planned for 2027",
        summary: "Unity’s cloud beta gives teams project access through a web dashboard, REST API, and CLI. The Tokyo demo showed asset changes, scene previews, and comments pinned to scene objects. The local Pipeline package handles automation inside a running Editor.",
        links: [["Hosted Pipeline docs", `${docs}/unity-production-pipeline`], ["Hosted beta signup and access details", `${unity}/features/unity-production-pipeline`], ["Watch the Tokyo demo", "https://www.youtube.com/watch?v=culEkDxK6dY"]]
      },
      {
        title: "Asset Library",
        status: "Editor plug-in and CLI experimental",
        summary: "Search for and import individual Asset Store items in Unity 6 or later through the Editor plug-in or use the experimental CLI. The CLI can search supported paid assets and imports free or owned items. Unity showed URP adaptation in the demo. Check the docs for supported assets and render pipeline variants.",
        links: [["Asset Library Editor plug-in", `${docs}/asset-store/asset-library/plugin-introduction`], ["Experimental Asset Library CLI", `${docs}/asset-store/asset-library/cli-introduction`]]
      },
      {
        title: "Method Reload, Content Directories, and DevOps",
        summary: "Unity showed opt-in Method Reload for changing supported methods while a game runs, including on IL2CPP devices. Local Content Directories are available, and remote distribution is planned. The DevOps roadmap showed Build Automation for Nintendo Switch and Switch 2, premium build caching, higher-performance compute, Unity Version Control merge requests, and Accelerator V2 with a free self-hosted version planned.",
        links: [["Method Reload package manual", "https://docs.unity3d.com/Packages/com.unity.pipeline@1.0/manual/method-reload.html"], ["Tokyo Content Directories session slides", "https://www.docswell.com/s/UnityJapan/Z4NP78-2026-11-18-141915"], ["Build Automation quick start", "https://learn.unity.com/tutorial/unity-build-automation"], slides(23)]
      }
    ]
  },
  {
    id: "platforms",
    title: "Platforms and builds",
    topics: [
      {
        title: "Meta VR Glasses and XR",
        summary: "Meta had already announced the hardware at Connect. At Tokyo, Unity covered developer tooling for Unity 6.7 or newer and Meta XR SDK v209. The roadmap also covered 7.1.4 spatial audio, 2D app spatialization, spatial containers on Android XR, and microgestures.",
        links: [["Build for Meta VR Glasses with Unity", `${unity}/blog/build-for-meta-vr-glasses-with-unity`], slides(63)]
      },
      {
        title: "Android, Googlebook, Steam, and Xbox",
        summary: "Unity targets official Googlebook support in 2027, including better large-screen and input support. The roadmap shows built-in Android and iOS dependency management, Android startup metrics, full-screen layout and controller updates, Steam Build Profiles for desktop, Xbox multi-target build profiles, and shared Windows and Xbox haptics.",
        links: [slides(58), ["Platform changes in Unity 6", "/whats-new/by-feature/platforms"]]
      },
      {
        title: "Platform Toolkit, Build Profiles, and Sentis",
        summary: "Unity showed a leaderboard API, platform authentication tokens, and Quest 3 and 3S support. Build Profiles plans include output path overrides and reusable partial settings. Sentis plans on-device AI acceleration through LiteRT on Android and Windows ML on Windows.",
        links: [slides(64)]
      }
    ]
  },
  {
    id: "creators",
    title: "Asset Store and creator programs",
    topics: [
      {
        title: "Synty Studios and Unity Spark",
        status: "Acquisition announced · Spark closed beta waitlist",
        summary: "Unity announced that it acquired Synty Studios. Synty’s packs remain on the Asset Store, and Unity plans to include the library from the start of the Spark closed beta.",
        links: [["Unity’s Synty acquisition announcement", `${unity}/blog/synty-studios-acquisition`], ["Synty on the Asset Store", "https://assetstore.unity.com/publishers/5217"], ["Unity Spark", `${unity}/spark`]]
      },
      {
        title: "Unity Fellowship",
        status: "Applications opened November 17",
        summary: "Unity’s program offers ten indie teams $50,000 each and launch support, with no revenue share or repayment. The first intake closes December 18, 2026 at 5 p.m. ET. Unity plans to announce the first teams at GDC in March 2027.",
        links: [["Fellowship application and eligibility", `${unity}/unity-fellowship`]]
      },
      {
        title: "Studio showcases",
        summary: "QualiArts and TVT shared how they used Unity tools for hololive Dreams and Ratatan during the keynote.",
        links: [["Unity’s Japanese keynote recap", `${unity}/ja/blog/unite-tokyo-2026-keynote-recap`]]
      }
    ]
  }
];

export const UNITE_TOKYO: UniteEvent = {
  path: UNITE_TOKYO_PATH,
  title: "Unite Tokyo 2026",
  description: "Unity 6.7 LTS and Unity 7 updates from Tokyo, plus graphics demos, coding tools, and creator programs.",
  cardSummary: "Unity 6.7 and Unity 7 updates, new graphics samples, Unity CLI 1.0, and the Unity Fellowship.",
  date: UNITE_TOKYO_DATE,
  reviewed: UNITE_TOKYO_REVIEWED,
  keynoteImage: UNITE_TOKYO_KEYNOTE_IMAGE,
  recordings: UNITE_TOKYO_RECORDINGS,
  sections: UNITE_TOKYO_SECTIONS,
  sources: UNITE_TOKYO_SOURCES
};
