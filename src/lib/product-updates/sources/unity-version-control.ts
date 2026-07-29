import {
  createVersionedUnityDocsAdapter,
  parsePublicIsoDate
} from "./unity-docs";

const URL =
  "https://docs.unity.com/en-us/unity-version-control/release-notes/11";

export const unityVersionControlAdapter = createVersionedUnityDocsAdapter({
  manifest: {
    sourceKey: "unity-version-control",
    displayName: "Unity Version Control 11.x release notes",
    family: "platform-services",
    parserVersion: "unity-version-control-html-v1",
    displayPriority: 10,
    allowedEvidenceHosts: ["docs.unity.com"],
    cadenceHours: 24,
    timeoutMs: 45_000,
    maxResponseBytes: 12 * 1024 * 1024,
    minimumExpectedRecords: 100,
    maximumExpectedRecords: 300,
    maximumRecordDropFraction: 0.25,
    targets: [
      {
        targetKey: "major-11",
        url: URL,
        allowedHosts: ["docs.unity.com"]
      }
    ]
  },
  rootHeading: /^11\.x release notes$/i,
  releaseHeading: /^11\.\d+\.\d+\.\d+$/,
  extractVersion: (heading) => heading,
  extractReleaseDate: parsePublicIsoDate,
  product: {
    key: "unity-version-control",
    slug: "unity-version-control",
    name: "Unity Version Control",
    description:
      "Unity's version control system, desktop clients, Gluon, command-line tools, and cloud repositories.",
    canonicalUrl:
      "https://docs.unity.com/en-us/unity-version-control/release-notes/overview",
    componentKey: "major-11"
  },
  title: (version) => `Unity Version Control ${version}`
});
