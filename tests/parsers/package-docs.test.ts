import { describe, expect, test } from "vitest";
import {
  isPlausibleUnifiedRelease,
  parseDocsChangelogTopVersion,
  unityMinorOfVersion,
  docsMinorOfEditor
} from "../../src/lib/parsers/package-docs";

describe("parseDocsChangelogTopVersion", () => {
  test("reads the newest version from a Unity docs changelog", () => {
    // Mirrors com.unity.entities@6.4: 6.4.0 continues from the 1.4.x line.
    const html = `
      <h1 id="changelog">Changelog</h1>
      <h2>[6.4.0] - 2025-10-16</h2>
      <p>Renumbered to align with Unity 6.4.</p>
      <h2>[1.4.2] - 2025-09-05</h2>
    `;
    expect(parseDocsChangelogTopVersion(html)).toEqual({
      version: "6.4.0",
      date: "2025-10-16"
    });
  });

  test("handles prerelease suffixes", () => {
    expect(parseDocsChangelogTopVersion("[6.5.0-pre.3] - 2026-01-02")).toEqual({
      version: "6.5.0-pre.3",
      date: "2026-01-02"
    });
  });

  test("returns null when there is no version entry", () => {
    expect(parseDocsChangelogTopVersion("<h1>Changelog</h1><p>No entries.</p>")).toBeNull();
    expect(parseDocsChangelogTopVersion("404 - page not found")).toBeNull();
  });
});

describe("unityMinorOfVersion", () => {
  test("extracts major.minor", () => {
    expect(unityMinorOfVersion("6.4.0")).toBe("6.4");
    expect(unityMinorOfVersion("6.4.0-pre.1")).toBe("6.4");
    expect(unityMinorOfVersion("1.4.7")).toBe("1.4");
  });
  test("null for non-versions", () => {
    expect(unityMinorOfVersion("garbage")).toBeNull();
  });
});

describe("docsMinorOfEditor", () => {
  test("maps a 6000.x editor to its docs minor", () => {
    expect(docsMinorOfEditor("6000.4.11f1")).toBe("6.4");
    expect(docsMinorOfEditor("6000.0.23f1")).toBe("6.0");
    expect(docsMinorOfEditor("6000.7.0a2")).toBe("6.7");
  });
  test("follows Unity into the next generation", () => {
    // The old `/^6000\./` regex returned null here, which silently disabled
    // unified-versioning discovery for every Unity 7 package.
    expect(docsMinorOfEditor("7000.0.0f1")).toBe("7.0");
    expect(docsMinorOfEditor("7000.1.3f1")).toBe("7.1");
  });
  test("null for legacy year-scheme editors", () => {
    expect(docsMinorOfEditor("2022.3.61f1")).toBeNull();
  });
});

describe("isPlausibleUnifiedRelease", () => {
  test("accepts a real unified-versioned build", () => {
    // com.unity.entities@6.5 - the genuine article.
    expect(isPlausibleUnifiedRelease({ version: "6.5.0", date: "2025-10-22" })).toBe(true);
    expect(isPlausibleUnifiedRelease({ version: "6.5.0", date: "2026-06-22" })).toBe(true);
  });

  test("rejects the coincidental SRP 6.5.x line from 2019", () => {
    // render-pipelines.core / shadergraph / visualeffectgraph /
    // render-pipelines.lightweight all really shipped 6.5.3 in April 2019,
    // so `@6.5/changelog` is a real page whose version matches the probed
    // minor. Prod claimed "Unity 6.5 ships as 6.5.3" for packages the
    // Editor bundles at 17.7.0.
    expect(isPlausibleUnifiedRelease({ version: "6.5.3", date: "2019-04-11" })).toBe(false);
    expect(isPlausibleUnifiedRelease({ version: "6.5.3-preview", date: "2019-04-11" })).toBe(false);
  });

  test("rejects other pre-era coincidences", () => {
    // xr.magicleap 6.4.1 (2021) and cloud.gltfast 6.5.0 (2024).
    expect(isPlausibleUnifiedRelease({ version: "6.4.1", date: "2021-10-13" })).toBe(false);
    expect(isPlausibleUnifiedRelease({ version: "6.5.0", date: "2024-05-15" })).toBe(false);
  });

  test("refuses an entry with no date rather than guessing", () => {
    expect(isPlausibleUnifiedRelease({ version: "6.5.0", date: null })).toBe(false);
  });
});
