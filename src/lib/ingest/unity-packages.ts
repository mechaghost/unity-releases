/**
 * Curated list of official Unity packages tracked by the package poller.
 *
 * Unity's package registry (https://packages.unity.com/) is lookup-only -
 * `/-/all` and `/-/v1/search` both 404, so there is no programmatic
 * discovery endpoint. This list is the canonical source until Unity ships
 * one.
 *
 * Packages that 404 at fetch time are skipped at runtime; missing entries
 * here can be appended without affecting the rest of the run.
 */
export const UNITY_OFFICIAL_PACKAGES: string[] = [
  // 2D
  "com.unity.2d.animation",
  "com.unity.2d.aseprite",
  "com.unity.2d.common",
  "com.unity.2d.pixel-perfect",
  "com.unity.2d.psdimporter",
  "com.unity.2d.spriteshape",
  "com.unity.2d.tilemap.extras",
  // com.unity.2d.sprite and com.unity.2d.tilemap are built-in modules in
  // Unity 6 (not registry-exposed - both 404 at packages.unity.com), so they
  // are intentionally not tracked here.

  // Addressables / Asset bundles
  "com.unity.addressables",
  "com.unity.addressables.android",
  "com.unity.scriptablebuildpipeline",

  // Asset Manager
  "com.unity.asset-manager-for-unity",

  // AI & navigation
  "com.unity.ai.assistant",
  "com.unity.ai.generators",
  "com.unity.ai.inference",
  "com.unity.ai.navigation",
  "com.unity.ai.toolkit",

  // Animation
  "com.unity.animation.rigging",
  "com.unity.live-capture",

  // Collaboration / version control
  "com.unity.collab-proxy",

  // Cinemachine
  "com.unity.cinemachine",

  // DOTS / ECS
  "com.unity.burst",
  "com.unity.collections",
  "com.unity.entities",
  "com.unity.entities.graphics",
  "com.unity.jobs",
  "com.unity.mathematics",
  "com.unity.physics",

  // Editor IDE integrations
  "com.unity.ide.rider",
  "com.unity.ide.visualstudio",
  "com.unity.ide.vscode",

  // Formats
  "com.unity.formats.alembic",
  "com.unity.formats.fbx",
  "com.unity.cloud.gltfast",

  // Input
  "com.unity.inputsystem",

  // Localization & logging
  "com.unity.localization",
  "com.unity.logging",

  // Memory & profiling
  "com.unity.memoryprofiler",
  "com.unity.profiling.core",

  // Mobile / notifications
  "com.unity.mobile.notifications",
  "com.unity.mobile.android-logcat",

  // Multiplayer & networking
  "com.unity.multiplayer.center",
  "com.unity.multiplayer.playmode",
  "com.unity.multiplayer.tools",
  "com.unity.netcode",
  "com.unity.netcode.gameobjects",
  "com.unity.dedicated-server",
  "com.unity.transport",

  // Muse
  "com.unity.muse.animate",
  "com.unity.muse.behavior",
  "com.unity.muse.chat",
  "com.unity.muse.common",
  "com.unity.muse.sprite",
  "com.unity.muse.texture",

  // Polybrush / ProBuilder / level design
  "com.unity.polybrush",
  "com.unity.probuilder",
  "com.unity.terrain-tools",

  // Post-processing
  "com.unity.postprocessing",

  // Purchasing / IAP
  "com.unity.purchasing",

  // Recorder
  "com.unity.recorder",

  // Render pipelines
  "com.unity.render-pipelines.core",
  "com.unity.render-pipelines.universal",
  // com.unity.render-pipelines.universal-config is bundled-only in Unity 6
  // (404 at packages.unity.com), so it is not tracked here.
  "com.unity.render-pipelines.high-definition",
  "com.unity.render-pipelines.high-definition-config",
  "com.unity.shadergraph",
  "com.unity.visualeffectgraph",

  // Sentis (AI inference)
  "com.unity.sentis",

  // Serialization & settings
  "com.unity.serialization",
  "com.unity.settings-manager",

  // Splines
  "com.unity.splines",

  // Test framework / coverage
  "com.unity.test-framework",
  "com.unity.testtools.codecoverage",

  // Text & UI
  "com.unity.textmeshpro",
  "com.unity.ugui",
  "com.unity.ui.builder",

  // Timeline
  "com.unity.timeline",

  // Tutorials (the framework ships as com.unity.learn.iet-framework;
  // com.unity.tutorials.core 404s at the registry)
  "com.unity.learn.iet-framework",

  // Visual scripting
  "com.unity.visualscripting",

  // XR / AR / VR
  "com.unity.xr.arfoundation",
  "com.unity.xr.arcore",
  "com.unity.xr.arkit",
  "com.unity.xr.core-utils",
  "com.unity.xr.hands",
  "com.unity.xr.interaction.toolkit",
  "com.unity.xr.legacyinputhelpers",
  "com.unity.xr.management",
  "com.unity.xr.meta-openxr",
  "com.unity.xr.oculus",
  "com.unity.xr.openxr",
  "com.unity.xr.windowsmr",
  "com.unity.xr.visionos",

  // Apple Vision Pro / PolySpatial
  "com.unity.polyspatial",
  "com.unity.polyspatial.extensions",
  "com.unity.polyspatial.visionos",
  "com.unity.polyspatial.xr",

  // Web platform
  "com.unity.web.stripping-tool",

  // Cloud services (com.unity.services.*)
  "com.unity.services.analytics",
  "com.unity.services.authentication",
  "com.unity.services.cloudcode",
  "com.unity.services.cloudsave",
  "com.unity.services.core",
  "com.unity.services.deployment",
  "com.unity.services.economy",
  "com.unity.services.friends",
  "com.unity.services.leaderboards",
  "com.unity.services.lobby",
  "com.unity.services.matchmaker",
  "com.unity.services.multiplay",
  "com.unity.services.multiplayer",
  "com.unity.services.push-notifications",
  "com.unity.services.qos",
  "com.unity.services.relay",
  // Remote Config publishes as com.unity.remote-config (the
  // com.unity.services.remote-config id 404s at the registry).
  "com.unity.remote-config",
  "com.unity.services.tooling",
  "com.unity.services.user-reporting",
  "com.unity.services.vivox",
  "com.unity.services.wire",

  // Additional registry packages discovered from Editor release notes.
  // Every entry returned HTTP 200 from packages.unity.com on 2026-07-28.
  // Keeping this as a separate cohort makes it easy to re-probe if Unity
  // later retires or absorbs one of these packages into the Editor.
  "com.unity.learn.iet-framework.authoring",
  "com.unity.microsoft.gdk",
  "com.unity.microsoft.gdk.tools",
  "com.unity.performance.profile-analyzer",
  "com.unity.adaptiveperformance",
  "com.unity.meta-instant-games-sdk",
  "com.unity.microsoft.gdk.discovery",
  "com.unity.services.moderation",
  "com.unity.xr.compositionlayers",
  "com.unity.services.cloud-build",
  "com.unity.sharp-zip-lib",
  "com.unity.services.levelplay",
  "com.unity.xr.androidxr-openxr",
  "com.unity.charactercontroller",
  "com.unity.project-auditor",
  "com.unity.cloud.draco",
  "com.unity.test-framework.performance",
  "com.unity.sdk.linux-arm64",
  "com.unity.services.deployment.api",
  "com.unity.cloud.ktx",
  "com.unity.bindings.openimageio",
  "com.unity.dt.app-ui",
  "com.unity.adaptiveperformance.google.android",
  "com.unity.profiling.systemmetrics.mali",
  "com.unity.services.ccd.management",
  "com.unity.ads",
  "com.unity.scripting.python",
  "com.unity.nuget.newtonsoft-json",
  "com.unity.2d.tooling",
  "com.unity.multiplayer.widgets",
  "com.unity.ext.flatsharp",
  "com.unity.sysroot.base",
  "com.unity.toolchain.macos-arm64-linux",
  "com.unity.toolchain.win-arm64-linux",
  "com.unity.ml-agents",
  "com.unity.sequences",
  "com.unity.xr.interactionsubsystems",
  "com.unity.barracuda",
  "com.unity.project-auditor-rules",
  "com.unity.nuget.mono-cecil",
  "com.unity.xr.arkit-face-tracking",
  "com.unity.xr.arsubsystems",
  "com.unity.ads.ios-support",
  "com.unity.analytics",
  "com.unity.connect.share",
  "com.unity.device-simulator.devices",
  "com.unity.sdk.embeddedlinux-aarch64",
  "com.unity.editorcoroutines",
  "com.unity.remote-config-runtime",
  "com.unity.scripting.python.linux",
  "com.unity.scripting.python.macos",
  "com.unity.scripting.python.windows",
  "com.unity.services.apis",
  "com.unity.services.cloud-diagnostics",
  "com.unity.zivart-player",
  "com.unity.services.mediation",
  "com.unity.sysroot",
  "com.unity.2d.enhancers",
  "com.unity.searcher",
  "com.unity.services.ugc",
  "com.unity.services.ugc.bridge",
  "com.unity.behavior",
  "com.unity.xr.magicleap",
  "com.unity.adaptiveperformance.samsung.android",
  "com.unity.ext.nunit",
  "com.unity.purchasing.udp",
  "com.unity.microsoft.gdk.intelligent-delivery",
  "com.unity.platformtoolkit",
  "com.unity.platformtoolkit.gamekit",
  "com.unity.platformtoolkit.gdk",
  "com.unity.platformtoolkit.playgamesservices",
  "com.unity.platformtoolkit.steam",
  "com.unity.ui",
  "com.unity.package-manager-ui",
  "com.unity.render-pipelines.lightweight",
  "com.unity.multiplayer.center.quickstart",
  "com.unity.multiplayer-hlapi",
  "com.unity.rendering.hybrid",
  "com.unity.services.analytics-runtime",
  "com.unity.template.3d",
  "com.unity.vectorgraphics"
];

/**
 * Package-like ids found in Editor notes that returned 404 on 2026-07-28.
 * The package poller keeps probing this separate watchlist: 404s remain cheap
 * no-ops, while anything Unity publishes later is ingested automatically
 * without pretending these are currently available registry packages.
 */
export const UNITY_REGISTRY_WATCHLIST_PACKAGES: string[] = [
  "com.unity.render-pipelines.universal-config",
  "com.unity.ui.test-framework",
  "com.unity.module.ai",
  "com.unity.path-tracing",
  "com.unity.entities.collections",
  "com.unity.entities.entities",
  "com.unity.adaptiveperformance.apple",
  "com.unity.rendering.denoising",
  "com.unity.rendering.light-transport",
  "com.unity.xr.interaction.subsystems",
  "com.unity.graphtoolsauthoringframework",
  "com.unity.shaderanalysis",
  "com.unity.2d.pixelperfect",
  "com.unity.multiplayer.samples.coop",
  "com.unity.openxr",
  "com.unity.graph-authoring",
  "com.unity.sysroot.linux-x86",
  "com.unity.toolchain.linux-x86",
  "com.unity.toolchain.macos-x86",
  "com.unity.toolchain.win-x86"
];

export function isPlausibleRegistryPackageName(value: string) {
  return /^com\.unity\.[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(value);
}

/**
 * Unity 6 GA cutoff for registry-freshness.
 *
 * Starting with Unity 6, many packages were absorbed into the Editor as
 * version-bound core packages and stopped publishing to packages.unity.com -
 * the whole render-pipeline family (URP/HDRP/core/shadergraph/VFX graph),
 * ugui, ui.builder, and others. Their registry "latest" is frozen at the last
 * independently-published version (e.g. URP shows 10.10.1 from 2022 while
 * Unity 6 actually ships 17.x bundled with the Editor). So a registry publish
 * date before this cutoff means the listed version is no longer a reliable
 * "current" signal - the truth lives in the Unity 6 / Editor docs. `/packages`
 * surfaces this via `isRegistryFrozen` so the stale "latest" isn't mistaken
 * for the current version.
 */
export const UNITY_6_REGISTRY_CUTOFF_ISO = "2024-10-01T00:00:00.000Z";

export function isRegistryFrozen(latestPublishedAt: string | null | undefined): boolean {
  if (!latestPublishedAt) return false;
  const published = new Date(latestPublishedAt).getTime();
  if (Number.isNaN(published)) return false;
  return published < new Date(UNITY_6_REGISTRY_CUTOFF_ISO).getTime();
}
