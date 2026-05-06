import { describe, expect, test } from "vitest";
import { parsePackageRegistry } from "../../src/lib/parsers/package-registry";
import { parseUnityBlogRss } from "../../src/lib/parsers/rss";
import { extractReleasePageMetadata } from "../../src/lib/parsers/release-page";
import { extractApiReleaseMetadata } from "../../src/lib/parsers/release-api";

describe("extractReleasePageMetadata", () => {
  test("extracts release metadata from a Unity page payload", () => {
    const html = `
      <script>self.__next_f.push([1,"releaseNotes\\\":{\\\"url\\\":\\\"https://storage.googleapis.com/live-platform-resources-prd/templates/assets/6000_3_14f1/6000_3_14f1.md\\\"},\\\"unityHubDeepLink\\\":\\\"unityhub://6000.3.14f1/d68c3f99a318\\\",\\\"releaseDate\\\":\\\"2026-04-22T12:21:09.823Z\\\",\\\"shortRevision\\\":\\\"d68c3f99a318\\\",\\\"version\\\":\\\"6000.3.14f1\\\",\\\"stream\\\":\\\"TECH\\\",\\\"downloads\\\":[{\\\"platform\\\":\\\"WINDOWS\\\",\\\"architecture\\\":\\\"X86_64\\\",\\\"url\\\":\\\"https://download.unity3d.com/editor.exe\\\",\\\"modules\\\":[{\\\"name\\\":\\\"Android Build Support\\\",\\\"category\\\":\\\"PLATFORM\\\",\\\"url\\\":\\\"https://download.unity3d.com/android.exe\\\"}]}]"])</script>
    `;

    expect(extractReleasePageMetadata(html, "https://unity.com/releases/editor/whats-new/6000.3.14f1")).toEqual({
      version: "6000.3.14f1",
      releaseDate: "2026-04-22T12:21:09.823Z",
      stream: "LTS",
      shortRevision: "d68c3f99a318",
      changeset: "d68c3f99a318",
      releasePageUrl: "https://unity.com/releases/editor/whats-new/6000.3.14f1",
      releaseNotesUrl:
        "https://storage.googleapis.com/live-platform-resources-prd/templates/assets/6000_3_14f1/6000_3_14f1.md",
      unityHubDeepLink: "unityhub://6000.3.14f1/d68c3f99a318",
      artifacts: [
        {
          platform: "WINDOWS",
          architecture: "X86_64",
          category: "EDITOR",
          name: "Unity Editor",
          url: "https://download.unity3d.com/editor.exe"
        }
      ],
      modules: [
        {
          platform: "WINDOWS",
          architecture: "X86_64",
          moduleName: "Android Build Support",
          moduleCategory: "PLATFORM",
          url: "https://download.unity3d.com/android.exe"
        }
      ]
    });
  });
});

describe("extractApiReleaseMetadata", () => {
  test("maps a Unity services API release into ReleasePageMetadata", () => {
    const metadata = extractApiReleaseMetadata({
      version: "6000.3.14f1",
      releaseDate: "2026-04-22T12:21:09.823Z",
      shortRevision: "d68c3f99a318",
      unityHubDeepLink: "unityhub://6000.3.14f1/d68c3f99a318",
      releaseNotes: { url: "https://storage.googleapis.com/release.md", type: "MD" },
      downloads: [
        {
          platform: "WINDOWS",
          architecture: "X86_64",
          url: "https://download.unity3d.com/editor.exe",
          modules: [
            { name: "Android Build Support", category: "PLATFORM", url: "https://download.unity3d.com/android.exe" }
          ]
        }
      ]
    });

    expect(metadata.version).toBe("6000.3.14f1");
    expect(metadata.stream).toBe("LTS");
    expect(metadata.releasePageUrl).toBe("https://unity.com/releases/editor/whats-new/6000.3.14f1");
    expect(metadata.releaseNotesUrl).toBe("https://storage.googleapis.com/release.md");
    expect(metadata.changeset).toBe("d68c3f99a318");
    expect(metadata.artifacts).toHaveLength(1);
    expect(metadata.artifacts[0]).toMatchObject({
      platform: "WINDOWS",
      architecture: "X86_64",
      category: "EDITOR",
      name: "Unity Editor"
    });
    expect(metadata.modules).toHaveLength(1);
    expect(metadata.modules[0]).toMatchObject({
      moduleName: "Android Build Support",
      moduleCategory: "PLATFORM"
    });
  });

  test("tolerates missing release notes URL by reporting null", () => {
    const metadata = extractApiReleaseMetadata({
      version: "6000.0.59f1",
      releaseDate: "2026-04-01T00:00:00.000Z"
    });
    expect(metadata.releaseNotesUrl).toBeNull();
    expect(metadata.artifacts).toEqual([]);
    expect(metadata.modules).toEqual([]);
  });
});

describe("parsePackageRegistry", () => {
  test("normalizes package metadata with optional fields", () => {
    const parsed = parsePackageRegistry({
      name: "com.unity.inputsystem",
      versions: {
        "1.19.0": {
          name: "com.unity.inputsystem",
          version: "1.19.0",
          displayName: "Input System",
          unity: "2022.3",
          _upm: { changelog: "### Fixed\n- Fixed virtual cursor." },
          dependencies: { "com.unity.modules.uielements": "1.0.0" },
          dist: {
            shasum: "abc123",
            tarball: "https://download.packages.unity.com/com.unity.inputsystem.tgz"
          }
        },
        "1.20.0-pre.1": {
          name: "com.unity.inputsystem",
          version: "1.20.0-pre.1"
        }
      },
      time: {
        "1.19.0": "2026-02-24T05:48:23.303Z"
      },
      "dist-tags": { latest: "1.19.0" }
    });

    expect(parsed.name).toBe("com.unity.inputsystem");
    expect(parsed.displayName).toBe("Input System");
    expect(parsed.versions).toHaveLength(2);
    expect(parsed.versions[0]).toMatchObject({
      version: "1.19.0",
      publishedAt: "2026-02-24T05:48:23.303Z",
      unityCompatibility: "2022.3",
      isPrerelease: false,
      shasum: "abc123"
    });
    expect(parsed.versions[1]).toMatchObject({
      version: "1.20.0-pre.1",
      isPrerelease: true
    });
  });
});

describe("parseUnityBlogRss", () => {
  test("parses Unity blog RSS entries", () => {
    const rss = `<?xml version="1.0"?><rss><channel><item><title>Unity 6 update</title><description>Details</description><link>https://unity.com/blog/unity-6-update</link><guid>post-1</guid><pubDate>Fri, 01 May 2026 00:00:00 GMT</pubDate><category>Engine</category></item></channel></rss>`;

    expect(parseUnityBlogRss(rss, "https://unity.com/blog/rss")).toEqual([
      {
        guid: "post-1",
        title: "Unity 6 update",
        description: "Details",
        link: "https://unity.com/blog/unity-6-update",
        publishedAt: "2026-05-01T00:00:00.000Z",
        categories: ["Engine"],
        feedUrl: "https://unity.com/blog/rss"
      }
    ]);
  });
});
