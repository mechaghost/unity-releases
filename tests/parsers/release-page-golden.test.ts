import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { extractReleasePageMetadata } from "@/lib/parsers/release-page";

/**
 * Golden test against a real Unity release page (bytes captured from
 * unity.com/releases/editor/whats-new/6000.3.19f1, push chunks only).
 *
 * The bug this guards: the legacy path regex-decoded the payload and then
 * walked it with a hand-rolled bracket matcher. A double quote inside ANY
 * value in the downloads array made `decodeEscapedPayload` rewrite the
 * value's `\\\"` into `\"`; `findMatchingBracket` then read the closing
 * quote as escaped, never found the array's end, and `extractDownloads`
 * swallowed the failure and returned []. Every artifact and every module
 * for that release vanished, with no error and no log line.
 *
 * It never fired in production only because no Unity module name or URL
 * happens to contain a quote - a property of Unity's naming, not of our
 * code. The quote-injection test below is the one that actually matters.
 */
const FIXTURE = readFileSync(
  join(process.cwd(), "tests/fixtures/releases/6000.3.19f1.flight.txt"),
  "utf8"
);
const URL = "https://unity.com/releases/editor/whats-new/6000.3.19f1";
const BACKSLASH = String.fromCharCode(92);

describe("golden: real Unity release page", () => {
  test("reads version, metadata, artifacts and modules", () => {
    const meta = extractReleasePageMetadata(FIXTURE, URL);
    expect(meta.version).toBe("6000.3.19f1");
    expect(meta.shortRevision).toBe("7689f4515d75");
    expect(meta.releaseDate?.slice(0, 10)).toBe("2026-07-01");
    expect(meta.unityHubDeepLink).toMatch(/^unityhub:\/\/6000\.3\.19f1\//);
    expect(meta.artifacts.length).toBe(5);
    expect(meta.modules.length).toBe(93);
    expect(meta.modules.map((m) => m.moduleName)).toContain("Android Build Support");
  });

  test("every artifact and module carries a platform and url", () => {
    const meta = extractReleasePageMetadata(FIXTURE, URL);
    for (const a of meta.artifacts) {
      expect(a.platform, "artifact platform").not.toBe("");
      expect(a.url, "artifact url").toMatch(/^https?:\/\//);
    }
    for (const m of meta.modules) {
      expect(m.platform, "module platform").not.toBe("");
      expect(m.moduleName, "module name").not.toBe("");
    }
  });

  test("a quote inside a module name does not wipe the download list", () => {
    // Reproduces the latent bug: inject the 4-char sequence Unity would
    // emit for a literal quote (`\\\"`) INSIDE the downloads array.
    // Before the Flight reader this returned 0 artifacts and 0 modules.
    const downloadsAt = FIXTURE.indexOf(`downloads${BACKSLASH}":[`);
    expect(downloadsAt).toBeGreaterThan(0);
    const target = FIXTURE.indexOf("Android Build Support", downloadsAt);
    expect(target).toBeGreaterThan(downloadsAt);

    const injected =
      FIXTURE.slice(0, target + 7) +
      BACKSLASH + BACKSLASH + BACKSLASH + '"' +
      FIXTURE.slice(target + 7);

    const meta = extractReleasePageMetadata(injected, URL);
    expect(meta.artifacts.length, "artifacts must survive an inner quote").toBe(5);
    expect(meta.modules.length, "modules must survive an inner quote").toBe(93);
  });

  test("a backslash inside a module name does not wipe the download list", () => {
    // The other half of the same family - a Windows path in a name.
    const downloadsAt = FIXTURE.indexOf(`downloads${BACKSLASH}":[`);
    const target = FIXTURE.indexOf("iOS Build Support", downloadsAt);
    const injected =
      FIXTURE.slice(0, target + 3) +
      BACKSLASH.repeat(4) +
      FIXTURE.slice(target + 3);
    const meta = extractReleasePageMetadata(injected, URL);
    expect(meta.modules.length).toBe(93);
  });
});
