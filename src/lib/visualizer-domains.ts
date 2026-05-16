/**
 * Edge-safe types and constants for the visualizer's domain filter. The
 * client component that renders the chip row imports from this file
 * instead of `visualizer.ts` so the browser bundle doesn't pull `pg`
 * through the chain (which fails for Edge runtimes — `net` / `tls`
 * aren't available).
 *
 * Keep this file dependency-free.
 */

export const DOMAINS = [
  "Rendering",
  "Scripting",
  "Mobile",
  "XR",
  "Physics",
  "UI",
  "Networking",
  "Editor",
  "Audio",
  "Animation",
  "Asset Pipeline",
  "Input"
] as const;

export type Domain = (typeof DOMAINS)[number];

/** Human-readable summary of which `area` labels each domain bucket
 *  matches. Used by hover-info popovers; mirrors the regex in
 *  `visualizer.ts` but kept as plain strings for display. */
export const DOMAIN_KEYWORDS: Record<Domain, string[]> = {
  Rendering: ["URP", "HDRP", "SRP", "Graphics", "Shader Graph", "Lighting", "GPU", "VFX", "Camera"],
  Scripting: ["C#", "IL2CPP", "Burst", "Mono", "Job System", "DOTS", "Entities", "Compiler"],
  Mobile: ["Android", "iOS"],
  XR: ["XR", "AR", "VR", "OpenXR", "VisionOS", "MR"],
  Physics: ["Physics", "Physics 2D", "Cloth"],
  UI: ["UI Toolkit", "UI Builder", "UIElements", "IMGUI", "UGUI", "TextMesh"],
  Networking: ["Netcode", "Multiplayer", "Transport", "Relay", "Lobby"],
  Editor: ["Editor", "Inspector", "Hierarchy", "Scene Management", "Build Profile", "Preferences"],
  Audio: ["Audio", "Sound", "DSP"],
  Animation: ["Animation", "Animator", "Timeline", "Mecanim"],
  "Asset Pipeline": ["Asset Bundle", "Addressables", "AssetDatabase", "Prefab", "Texture", "Mesh"],
  Input: ["Input System", "Touch", "Pointer", "Gamepad", "Keyboard", "Mouse"]
};
