/**
 * Curated list of official Unity packages tracked by the package poller.
 *
 * Unity's package registry (https://packages.unity.com/) is lookup-only —
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
  "com.unity.2d.pixel-perfect",
  "com.unity.2d.psdimporter",
  "com.unity.2d.sprite",
  "com.unity.2d.spriteshape",
  "com.unity.2d.tilemap",
  "com.unity.2d.tilemap.extras",

  // Addressables / Asset bundles
  "com.unity.addressables",
  "com.unity.scriptablebuildpipeline",

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
  "com.unity.render-pipelines.universal-config",
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

  // Tutorials
  "com.unity.tutorials.core",

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

  // Cloud services (com.unity.services.*)
  "com.unity.services.analytics",
  "com.unity.services.authentication",
  "com.unity.services.cloudcode",
  "com.unity.services.cloud-save",
  "com.unity.services.core",
  "com.unity.services.deployment",
  "com.unity.services.economy",
  "com.unity.services.friends",
  "com.unity.services.leaderboards",
  "com.unity.services.lobby",
  "com.unity.services.matchmaker",
  "com.unity.services.multiplay",
  "com.unity.services.push-notifications",
  "com.unity.services.qos",
  "com.unity.services.relay",
  "com.unity.services.remote-config",
  "com.unity.services.tooling",
  "com.unity.services.user-reporting",
  "com.unity.services.vivox",
  "com.unity.services.wire"
];
