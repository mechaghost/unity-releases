import { createVersionedUnityDocsAdapter } from "./unity-docs";

export const vivoxUnityAdapter = createVersionedUnityDocsAdapter({
  manifest: {
    sourceKey: "vivox-unity",
    displayName: "Vivox Unity SDK release notes",
    family: "platform-services",
    parserVersion: "vivox-unity-html-v1",
    displayPriority: 10,
    allowedEvidenceHosts: ["docs.unity.com"],
    cadenceHours: 24,
    timeoutMs: 30_000,
    maxResponseBytes: 2 * 1024 * 1024,
    minimumExpectedRecords: 10,
    maximumExpectedRecords: 100,
    maximumRecordDropFraction: 0.4,
    targets: [
      {
        targetKey: "unity",
        url: "https://docs.unity.com/en-us/vivox-unity/release-notes",
        allowedHosts: ["docs.unity.com"]
      }
    ]
  },
  rootHeading: /^vivox unity release notes$/i,
  releaseHeading: /^version \d+\.\d+\.\d+$/i,
  extractVersion: (heading) => heading.match(/^version (.+)$/i)?.[1] ?? null,
  product: {
    key: "vivox-unity",
    slug: "vivox-unity",
    name: "Vivox Unity SDK",
    description: "Voice and text chat SDK for Unity projects.",
    canonicalUrl: "https://docs.unity.com/en-us/vivox-unity",
    componentKey: "unity"
  },
  title: (version) => `Vivox Unity SDK ${version}`
});

export const vivoxCoreAdapter = createVersionedUnityDocsAdapter({
  manifest: {
    sourceKey: "vivox-core",
    displayName: "Vivox Core SDK release notes",
    family: "platform-services",
    parserVersion: "vivox-core-html-v1",
    displayPriority: 10,
    allowedEvidenceHosts: ["docs.unity.com"],
    cadenceHours: 24,
    timeoutMs: 30_000,
    maxResponseBytes: 2 * 1024 * 1024,
    minimumExpectedRecords: 4,
    maximumExpectedRecords: 100,
    maximumRecordDropFraction: 0.5,
    targets: [
      {
        targetKey: "core",
        url: "https://docs.unity.com/vivox-core/core-release-notes",
        allowedHosts: ["docs.unity.com"]
      }
    ]
  },
  rootHeading: /^release notes$/i,
  releaseHeading: /^version \d+\.\d+\.\d+$/i,
  extractVersion: (heading) => heading.match(/^version (.+)$/i)?.[1] ?? null,
  product: {
    key: "vivox-core",
    slug: "vivox-core",
    name: "Vivox Core SDK",
    description: "Native foundation SDK for Vivox voice and text chat.",
    canonicalUrl: "https://docs.unity.com/vivox-core",
    componentKey: "core"
  },
  title: (version) => `Vivox Core SDK ${version}`
});

export const vivoxUnrealAdapter = createVersionedUnityDocsAdapter({
  manifest: {
    sourceKey: "vivox-unreal",
    displayName: "Vivox Unreal SDK release notes",
    family: "platform-services",
    parserVersion: "vivox-unreal-html-v1",
    displayPriority: 10,
    allowedEvidenceHosts: ["docs.unity.com"],
    cadenceHours: 24,
    timeoutMs: 30_000,
    maxResponseBytes: 2 * 1024 * 1024,
    minimumExpectedRecords: 4,
    maximumExpectedRecords: 100,
    maximumRecordDropFraction: 0.5,
    targets: [
      {
        targetKey: "unreal",
        url: "https://docs.unity.com/en-us/vivox-unreal/unreal-release-notes",
        allowedHosts: ["docs.unity.com"]
      }
    ]
  },
  rootHeading: /^release notes$/i,
  releaseHeading: /^release notes for \d+\.\d+\.\d+\.unr\.\d+$/i,
  extractVersion: (heading) =>
    heading.match(/^release notes for (.+)$/i)?.[1] ?? null,
  product: {
    key: "vivox-unreal",
    slug: "vivox-unreal",
    name: "Vivox Unreal SDK",
    description: "Voice and text chat SDK integration for Unreal Engine.",
    canonicalUrl: "https://docs.unity.com/en-us/vivox-unreal/unreal",
    componentKey: "unreal"
  },
  title: (version) => `Vivox Unreal SDK ${version}`
});
