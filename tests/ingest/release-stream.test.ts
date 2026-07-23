import { describe, expect, test } from "vitest";
import {
  resolveIngestStream,
  storedReleaseCanBeSkipped
} from "../../src/lib/ingest/release-stream";

describe("resolveIngestStream", () => {
  test("prefers Unity's API stream for a final build, even with a stored value", () => {
    expect(
      resolveIngestStream({ version: "7000.0.0f1", apiStream: "LTS", storedStream: "Update/Supported" })
    ).toEqual({ stream: "LTS", source: "api" });
  });

  test("keeps the stored stream on API failure rather than downgrading a final build", () => {
    // The core R1 fix: 7000.0 is a new-generation LTS line the curated map
    // doesn't know, so the version-number fallback guesses "Update/Supported".
    // On an API blip that must NOT overwrite a previously-correct stored LTS.
    expect(
      resolveIngestStream({ version: "7000.0.0f1", apiStream: null, storedStream: "LTS" })
    ).toEqual({ stream: "LTS", source: "retained" });
  });

  test("uses the version-derived stream when API fails and nothing is stored yet", () => {
    // First ingest of a known LTS line: map gets it right, no stored value.
    expect(
      resolveIngestStream({ version: "6000.3.20f1", apiStream: null, storedStream: null })
    ).toEqual({ stream: "LTS", source: "parsed" });
    // First ingest of a line the map doesn't know: best-available guess.
    expect(
      resolveIngestStream({ version: "7000.0.0f1", apiStream: null, storedStream: null })
    ).toEqual({ stream: "Update/Supported", source: "parsed" });
  });

  test("does not 'retain' when the stored value already matches the guess", () => {
    expect(
      resolveIngestStream({ version: "6000.3.20f1", apiStream: null, storedStream: "LTS" })
    ).toEqual({ stream: "LTS", source: "parsed" });
  });

  test("alpha/beta/patch are channel-derived and never retained", () => {
    // These are unambiguous from the version, so a stale stored value must not
    // override them - a build reclassified to a release channel is a real change.
    expect(
      resolveIngestStream({ version: "6000.7.0a2", apiStream: null, storedStream: "LTS" })
    ).toEqual({ stream: "alpha", source: "parsed" });
    expect(
      resolveIngestStream({ version: "6000.6.0b5", apiStream: null, storedStream: "LTS" })
    ).toEqual({ stream: "beta", source: "parsed" });
    expect(
      resolveIngestStream({ version: "2020.3.48p1", apiStream: null, storedStream: "LTS" })
    ).toEqual({ stream: "patch", source: "parsed" });
  });

  test("an alpha's API stream still wins when present (source stays api)", () => {
    expect(
      resolveIngestStream({ version: "6000.7.0a2", apiStream: "ALPHA", storedStream: null })
    ).toEqual({ stream: "alpha", source: "api" });
  });

  test("an unknown API value is a failure, not an authoritative answer", () => {
    expect(
      resolveIngestStream({ version: "7000.0.0f1", apiStream: "TECH", storedStream: "LTS" })
    ).toEqual({ stream: "LTS", source: "retained" });
    expect(
      resolveIngestStream({ version: "7000.0.0f1", apiStream: "TECH", storedStream: null })
    ).toEqual({ stream: "Update/Supported", source: "parsed" });
  });
});

describe("storedReleaseCanBeSkipped", () => {
  const currentParserVersion = "2026-05-04";

  test("forces backfill to repair a first-ingest fallback stream", () => {
    expect(
      storedReleaseCanBeSkipped({
        version: "7000.0.0f1",
        apiStream: "LTS",
        storedStream: "Update/Supported",
        storedParserVersion: currentParserVersion,
        currentParserVersion
      })
    ).toBe(false);
  });

  test("skips only when parser and recognized API stream are current", () => {
    expect(
      storedReleaseCanBeSkipped({
        version: "7000.0.0f1",
        apiStream: "LTS",
        storedStream: "LTS",
        storedParserVersion: currentParserVersion,
        currentParserVersion
      })
    ).toBe(true);
    expect(
      storedReleaseCanBeSkipped({
        version: "7000.0.0f1",
        apiStream: "LTS",
        storedStream: "LTS",
        storedParserVersion: "old-parser",
        currentParserVersion
      })
    ).toBe(false);
  });

  test("does not replay a current row when the API value is unrecognized", () => {
    expect(
      storedReleaseCanBeSkipped({
        version: "7000.0.0f1",
        apiStream: "TECH",
        storedStream: "LTS",
        storedParserVersion: currentParserVersion,
        currentParserVersion
      })
    ).toBe(true);
  });
});
