import { createVersionedUnityDocsAdapter } from "./unity-docs";

const URL = "https://docs.unity.com/en-us/licensing-server/whats-new";

export const licensingServerAdapter = createVersionedUnityDocsAdapter({
  manifest: {
    sourceKey: "licensing-server",
    displayName: "Unity Licensing Server what's new",
    family: "platform-services",
    parserVersion: "licensing-server-html-v1",
    displayPriority: 10,
    allowedEvidenceHosts: ["docs.unity.com"],
    cadenceHours: 24,
    timeoutMs: 30_000,
    maxResponseBytes: 2 * 1024 * 1024,
    minimumExpectedRecords: 3,
    maximumExpectedRecords: 100,
    maximumRecordDropFraction: 0.5,
    targets: [
      {
        targetKey: "server",
        url: URL,
        allowedHosts: ["docs.unity.com"]
      }
    ]
  },
  rootHeading: /^what's new$/i,
  releaseHeading: /^version \d+\.\d+\.\d+$/i,
  extractVersion: (heading) => heading.match(/^version (.+)$/i)?.[1] ?? null,
  product: {
    key: "unity-licensing-server",
    slug: "unity-licensing-server",
    name: "Unity Licensing Server",
    description:
      "Self-hosted floating license administration and reporting for Unity organizations.",
    canonicalUrl: URL,
    componentKey: "server"
  },
  title: (version) => `Unity Licensing Server ${version}`
});
