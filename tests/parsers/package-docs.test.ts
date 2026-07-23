import { describe, expect, test } from "vitest";
import {
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
