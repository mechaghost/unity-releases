import { UNITE_SEOUL_PATH, UNITE_TOKYO_PATH } from "./unite-event-paths";
import type { UniteEvent } from "./unite-events";

const recap = "https://unity.com/blog/unite-seoul-keynote-2026-recap";
const press = "https://unity.com/news/unity-7-roadmap-revealed-at-unite-seoul";
const agenda = "https://www.unitysquare.co.kr/unityseoul/unityseoul2026/agenda";
const assets = "https://cdn.sanity.io/images/fuvbjjlp/production";
const bunnyBlitzSample = "https://assetstore.unity.com/packages/templates/packs/bunny-blitz-2d-3d-sample-project-393078";
const keynoteChapters = "https://www.youtube.com/watch?v=n-3XvhUzMc0";

export const UNITE_SEOUL: UniteEvent = {
  path: UNITE_SEOUL_PATH,
  title: "Unite Seoul 2026",
  description: "Unity announced Unity 7 in Seoul and showed CoreCLR, real-time lighting in URP, and new ways to work with Unity projects from the terminal and browser.",
  cardSummary: "The Unity 7 announcement, CoreCLR, new URP lighting, and a Unity game running in Unreal.",
  date: "2026-07-21",
  reviewed: "2026-11-21",
  keynoteImage: {
    src: "/images/unite-seoul-2026/keynote.webp",
    alt: "The Unite Seoul keynote stage with the event logo on the main screen",
    width: 1200,
    height: 800,
    original: `${assets}/f7a78ec3cb1f838a8b0ae8c13d479aaf3e7760b8-3504x2336.jpg`,
    source: recap
  },
  recordings: [
    ["Watch the keynote", "https://www.youtube.com/watch?v=ZTkvearTewE"],
    ["Watch the roadmap session", "https://www.youtube.com/watch?v=M3ncIGe4s-0"]
  ],
  sections: [
    {
      id: "editor",
      title: "Editor and engine",
      topics: [
        {
          slug: "unity-7-announcement",
          title: "Unity 7 announced",
          teaser: "Read the original Unity 7 roadmap and find the latest upgrade guidance.",
          status: "July announcement",
          summary: "Unity introduced Unity 7 as a continuation of Unity 6. The July roadmap targeted a December 2026 beta and a first-quarter 2027 release. Unity later published a list of planned breaking changes, including platform and rendering changes to check before upgrading.",
          links: [
            ["Unity 7 announcement", press],
            ["Planned Unity 7.0 breaking changes", "https://discussions.unity.com/t/planned-breaking-changes-in-unity-7-0/1740094"],
            ["November release and roadmap update from Tokyo", UNITE_TOKYO_PATH + "#editor"]
          ]
        },
        {
          slug: "coreclr-and-iteration",
          title: "CoreCLR and faster iteration",
          teaser: "See Unity’s planned .NET upgrade and a demo of live code changes on a device.",
          status: "Shown on the roadmap",
          summary: "Unity outlined CoreCLR, .NET 10, C# 14, and MSBuild for Unity 7, along with a new code reload model. It also showed faster entry into Play Mode in new Unity 6.6 projects, migration checks in Project Auditor, and live code changes on a mobile device.",
          links: [
            ["CoreCLR upgrade guide", "https://discussions.unity.com/t/path-to-coreclr-2026-upgrade-guide/1714279"],
            ["Unity 6.6 release guide", "/whats-new/unity-6-6"],
            ["Watch the live code iteration demo", keynoteChapters + "&t=4575s"]
          ]
        }
      ]
    },
    {
      id: "graphics",
      title: "Graphics and 2D",
      demos: [
        {
          topicSlug: "dynamic-lighting-in-urp",
          image: {
            src: "/images/unite-seoul-2026/mecha-hangar.webp",
            alt: "Charles Sanglimsuwan onstage with Sakura Rabbit’s Mecha Repair Hangar projected behind him",
            width: 960,
            height: 720,
            original: `${assets}/f28c2e09613720e08b5b5b6dd4cd8187610c8d31-5712x4284.jpg`,
            source: recap
          },
          video: ["Watch the Surface Cache GI demo", keynoteChapters + "&t=1237s"],
          credit: "Mecha Repair Hangar photo from Unity"
        },
        {
          topicSlug: "bunny-blitz-and-2d",
          image: {
            src: "/images/unite-seoul-2026/bunny-blitz.webp",
            alt: "Bunny Blitz sample artwork with a cartoon rabbit and platforms in a brightly lit fantasy scene",
            width: 960,
            height: 540,
            original: `${assets}/dd2c892d5cc04a6e02a66faef389c132b542c876-3840x2160.png`,
            source: recap
          },
          video: ["Watch the 2D demo", keynoteChapters + "&t=1623s"],
          credit: "Bunny Blitz image from Unity"
        }
      ],
      topics: [
        {
          slug: "dynamic-lighting-in-urp",
          title: "Dynamic lighting in URP",
          teaser: "Watch the Mecha Repair Hangar demo for real-time lighting in URP.",
          status: "Unity 6.7 alpha at Seoul",
          summary: "Sakura Rabbit’s Mecha Repair Hangar demo showed Surface Cache GI updating indirect light as the scene changed. Unity paired it with screen-space reflections and ground-truth ambient occlusion. The three features were in preview at the event.",
          links: [
            ["Surface Cache GI preview", "https://discussions.unity.com/t/surface-cache-gi-preview/1720494"],
            ["Graphics changes in Unity 6", "/whats-new/by-feature/3d"]
          ]
        },
        {
          slug: "bunny-blitz-and-2d",
          title: "Bunny Blitz and 2D workflows",
          teaser: "Try the sample that blends 3D characters and objects into a 2D scene.",
          status: "Sample available",
          summary: "Unity’s Bunny Blitz sample shows how to use 3D characters and objects in a 2D scene. The 2D talk also covered Physics Core 2D, rendering large numbers of sprites with RenderSprite, and tracking sprite and atlas usage in the Profiler.",
          links: [
            ["Bunny Blitz 2D & 3D sample on the Asset Store", bunnyBlitzSample],
            ["2D changes in Unity 6", "/whats-new/by-feature/2d"]
          ]
        },
        {
          slug: "webgpu-shaders-and-mobile",
          title: "WebGPU, shaders, and mobile rendering",
          teaser: "Find the WebGPU and shader changes Unity presented for 6.6 and 6.7.",
          summary: "Unity presented production-ready WebGPU support for Unity 6.6, DXC shader compilation for DirectX 12, and more control over shader builds. The roadmap also showed a fast shader build profile for 6.7 and mobile rendering changes designed to reduce memory traffic.",
          links: [
            ["Unity 6.6 release announcement", "https://discussions.unity.com/t/unity-6-6-is-now-available/1735357"],
            ["Unity 6.6 shader build settings", "/whats-new/unity-6-6/shader-compilation"]
          ]
        },
        {
          slug: "unity-neural",
          title: "Unity Neural",
          teaser: "See how Unity introduced neural upscaling and texture compression.",
          status: "Shown on the roadmap",
          summary: "Unity introduced an updated upscaling framework and Neural Texture Compression. The keynote showed on-device inference through Sentis, with the first Unity Neural features planned for Unity 6.7 and more planned for Unity 7.",
          links: [
            ["Unity 7 graphics roadmap", press],
            ["November Unity Neural update from Tokyo", UNITE_TOKYO_PATH + "#graphics"]
          ]
        }
      ]
    },
    {
      id: "tools",
      title: "Development and collaboration tools",
      topics: [
        {
          slug: "cli-and-production-pipeline",
          title: "Unity CLI and hosted Production Pipeline",
          teaser: "See the browser-to-Editor workflow Unity demoed with the CLI and hosted tools.",
          status: "Previewed at Seoul",
          summary: "The keynote showed an artist fixing a texture from a browser, checking it in Scene Preview, and sending it through version control. Unity then used the CLI to validate and push updated content to a running Nintendo Switch 2. Unity opened closed-beta applications for the hosted production tools. The CLI and local Editor package have their own release histories.",
          links: [
            ["Hosted Production Pipeline beta", "https://docs.unity.com/en-us/unity-production-pipeline"],
            ["Unity CLI release guide", "/whats-new/unity-cli"],
            ["Local Unity Pipeline package guide", "/whats-new/unity-pipeline"]
          ]
        },
        {
          slug: "unity-studio-and-automation",
          title: "Unity Studio and industrial automation",
          teaser: "See collaboration in Unity Studio and Unity’s plans for industrial asset workflows.",
          summary: "Unity Studio demonstrated multiple teammates working in a shared 3D scene from their browsers. Unity also announced Pipeline Automation for industry workflows that bring in assets from product data systems, optimize them, and publish them to 3D applications.",
          links: [
            ["Unity Industry product update", "https://unity.com/blog/unity-industry-product-releases-2026"],
            ["Unity Studio release notes", "https://docs.unity.com/en-us/unity-studio/whats-new"]
          ]
        }
      ]
    },
    {
      id: "platforms",
      title: "Platforms and builds",
      topics: [
        {
          slug: "meta-quest-and-xreal-aura",
          title: "Meta Quest tools and XREAL AURA",
          teaser: "Find the Quest developer tools and Unity’s wired Android XR support.",
          summary: "Unity and Meta showed agent-assisted workflows for building and validating Quest projects. Unity also covered its Android XR support for XREAL AURA and showed how Resolution Games brought Demeo to the device.",
          links: [
            ["Unity’s wired Android XR support", "https://unity.com/blog/unity-android-xr-wired-glasses-support"],
            ["Meta Quest developer tools", "https://github.com/meta-quest/agentic-tools"]
          ]
        },
        {
          slug: "unity-inside-unreal",
          title: "Unity inside Unreal Engine",
          teaser: "See how the Fantasy Kingdom demo split simulation and rendering across two engines.",
          status: "Technical demo",
          summary: "Unity and Epic showed a Unity simulation rendered in Unreal Engine. The Fantasy Kingdom demo synchronized lighting, physics, and input across engines. Unity invited developers to register interest for early access in 2027.",
          links: [
            ["Unity’s Fantasy Kingdom sample", "https://unity.com/demos/fantasy-kingdom"],
            ["Unity and Epic early access interest form", "https://create.unity.com/unity-on-fortnite-unreal-interest-form"]
          ]
        }
      ]
    },
    {
      id: "commerce",
      title: "Commerce and growth",
      topics: [
        {
          slug: "unity-iap-and-direct-sales",
          title: "Unity IAP 5.4 and direct sales",
          teaser: "See what Unity announced for direct checkout, webshops, and shared catalogs.",
          status: "Announced as available at Seoul",
          summary: "Unity introduced direct checkout and a no-code webshop builder alongside IAP 5.4. The SDK and dashboard can share a catalog and report sales across supported checkout methods. Unity named Stripe and Coda as initial payments partners.",
          links: [["Unity IAP release and commerce documentation", "https://docs.unity.com/en-us/iap/whats-new"]]
        },
        {
          slug: "unity-vector-and-ad-tools",
          title: "Unity Vector and ad campaign tools",
          teaser: "Watch Unity’s plans for ad creatives, campaign tools, and reporting.",
          status: "Shown on the roadmap",
          summary: "Unity discussed planned tools for managing ad creatives and measuring their performance. It also announced Unity Ads MCP and Campaign Assistant for working with campaigns, budgets, and bids from AI tools.",
          links: [["Watch the Unity Vector keynote segment", keynoteChapters + "&t=2636s"]]
        }
      ]
    }
  ],
  sources: [
    ["Keynote recap", recap],
    ["Unity 7 press announcement", press],
    ["Seoul event schedule", agenda],
    ["Watch the engine keynote highlights", "https://www.youtube.com/watch?v=c-ewWHQk_Sc"]
  ]
};
