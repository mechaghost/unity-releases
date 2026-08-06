import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { assetTransformerAdapter } from "../../src/lib/product-updates/sources/asset-transformer";
import {
  UNITY_STUDIO_RELEASE_TARGETS,
  unityStudioAdapter
} from "../../src/lib/product-updates/sources/unity-studio";
import {
  vpcAwsAdapter,
  vpcOnPremisesAdapter,
  vpctlAdapter
} from "../../src/lib/product-updates/sources/vpc";
import type {
  ProductUpdateAdapter,
  ProductUpdateSnapshot
} from "../../src/lib/product-updates/types";
import { validateObservations } from "../../src/lib/product-updates/validation";

describe("Industry and enterprise Product Update adapters", () => {
  test("pins Studio detail pages but discovers versions from its stable index", () => {
    expect(UNITY_STUDIO_RELEASE_TARGETS).toHaveLength(13);
    expect(unityStudioAdapter.manifest.targets).toHaveLength(14);
    expect(
      new Set(unityStudioAdapter.manifest.targets.map((target) => target.targetKey))
        .size
    ).toBe(14);

    const index = parse(
      unityStudioAdapter,
      "index",
      readFixture("unity-studio-index.html")
    );
    expect(index).toHaveLength(2);
    expect(index[0]).toMatchObject({
      productKey: "unity-studio",
      version: "1.1",
      sourceUrl:
        "https://docs.unity.com/en-us/unity-studio/whats-new/studio-1-1"
    });

    const detail = parse(
      unityStudioAdapter,
      "1-1",
      readFixture("unity-studio-release.html")
    );
    expect(detail).toHaveLength(1);
    expect(detail[0]).toMatchObject({
      canonicalKey: "version:1.1",
      releaseDate: null
    });
    expect(detail[0].items.map((item) => item.changeKind)).toEqual([
      "feature",
      "fix"
    ]);
  });

  test("merges duplicate Asset Transformer versions and preserves table changes", () => {
    const observations = parse(
      assetTransformerAdapter,
      "sdk",
      readFixture("asset-transformer.html")
    );
    expect(observations).toHaveLength(2);
    expect(observations[0]).toMatchObject({
      productKey: "asset-transformer-sdk",
      version: "2026.4.0",
      releaseDate: "2026-05-01T00:00:00.000Z",
      metadata: { datePrecision: "month", legacyName: "Pixyz" }
    });
    expect(observations[0].items.map((item) => item.section)).toContain(
      "Reference changes"
    );
    expect(observations[1]).toMatchObject({
      version: "2025.4.2",
      releaseDate: "2025-10-01T00:00:00.000Z"
    });
    expect(observations[1].items).toHaveLength(2);
  });

  test("keeps AWS and on-premises Self-Hosted histories independent", () => {
    const aws = parse(vpcAwsAdapter, "aws", readFixture("vpc-aws.html"));
    const onPremises = parse(
      vpcOnPremisesAdapter,
      "on-premises",
      readFixture("vpc-on-premises.html")
    );
    expect(aws[0]).toMatchObject({
      productKey: "unity-cloud-self-hosted",
      componentKey: "aws",
      version: "1.3.0",
      releaseDate: "2026-06-08T00:00:00.000Z"
    });
    expect(onPremises[0]).toMatchObject({
      componentKey: "on-premises",
      version: "0.14.0",
      releaseDate: "2026-06-03T00:00:00.000Z"
    });
    expect(aws[0].updateSlug).not.toBe(onPremises[0].updateSlug);
  });

  test("reads div-wrapped prose releases that carry no bullet list", () => {
    // Regression: docs.unity.com renders paragraphs as text nodes inside a
    // MuiBox <div>, with inline code as a NESTED <div><pre><code>. The
    // extractor only walked direct-sibling ul/ol/p/span, so a release
    // written entirely as prose produced zero items and threw "has no
    // changes" - which quarantined the source as parser-drift and crashed
    // the nightly industry-enterprise cron.
    const aws = parse(vpcAwsAdapter, "aws", readFixture("vpc-aws.html"));
    const prose = aws.find((observation) => observation.version === "1.2.2");

    expect(prose).toBeDefined();
    expect(prose!.items).toHaveLength(2);
    // The whole sentence survives, with the nested code inlined - not the
    // bare token the first attempt at this fix produced.
    expect(prose!.items[0].body).toContain("post-deployment job now runs on AWS");
    expect(prose!.items[0].body).toContain("`upc-onboarding`");
    expect(prose!.items[0].section).toBe("New features");
    expect(prose!.items[1].body).toContain("idempotent");
  });

  test("keeps vpctl's nested product-version heading inside the CLI release", () => {
    const observations = parse(vpctlAdapter, "cli", readFixture("vpctl.html"));
    expect(observations).toHaveLength(3);
    expect(observations[0]).toMatchObject({
      productKey: "vpctl",
      version: "0.11.0",
      releaseDate: "2026-06-03T00:00:00.000Z"
    });
    expect(observations[0].items).toHaveLength(2);
    expect(observations[2]).toMatchObject({
      version: "0.4.0",
      releaseDate: null,
      metadata: { datePrecision: "unknown" }
    });
  });

  test("skips an unextractable version instead of failing the whole source", () => {
    // A single empty section is benign upstream authoring, not drift. It used
    // to throw, which failed the job, quarantined the target, and made Railway
    // report the cron as crashed every night. The rest of the page must still
    // ingest, and real drift (below) must still be fatal.
    const page = `
      <main>
        <h1>Release notes for Self-Hosted Deployment in Amazon Web Services</h1>
        <h2>Version 2.0.0 — July 1, 2026</h2>
        <h3>Coming soon</h3>
        <h2>Version 1.9.0 — June 1, 2026</h2>
        <h3>Fixed issues</h3>
        <ul><li>Fixed a real thing.</li></ul>
      </main>`;

    const observations = parse(vpcAwsAdapter, "aws", page);
    expect(observations.map((o) => o.version)).toEqual(["1.9.0"]);
  });

  test("quarantines structurally unrelated enterprise pages", () => {
    expect(() => parse(unityStudioAdapter, "index", "<h1>Other</h1>")).toThrow(
      /root heading/
    );
    expect(() =>
      parse(assetTransformerAdapter, "sdk", "<h1>Other</h1>")
    ).toThrow(/root heading/);
    expect(() => parse(vpcAwsAdapter, "aws", "<h1>Other</h1>")).toThrow(
      /root heading/
    );
    expect(() => parse(vpctlAdapter, "cli", "<h1>Other</h1>")).toThrow(
      /root heading/
    );
  });
});

function readFixture(name: string) {
  return readFileSync(
    new URL(`../fixtures/product-updates/${name}`, import.meta.url),
    "utf8"
  );
}

function parse(adapter: ProductUpdateAdapter, targetKey: string, text: string) {
  const observations = adapter.parse(snapshot(adapter, targetKey, text));
  return validateObservations(
    observations,
    { ...adapter.manifest, minimumExpectedRecords: 1 },
    null
  );
}

function snapshot(
  adapter: ProductUpdateAdapter,
  targetKey: string,
  text: string
): ProductUpdateSnapshot {
  const target = adapter.manifest.targets.find(
    (candidate) => candidate.targetKey === targetKey
  );
  if (!target) throw new Error(`Missing fixture target ${targetKey}`);
  return {
    sourceKey: adapter.manifest.sourceKey,
    targetKey,
    requestedUrl: target.url,
    finalUrl: target.url,
    fetchedAt: "2026-07-28T00:00:00.000Z",
    status: 200,
    etag: null,
    lastModified: null,
    sha256: "fixture",
    text
  };
}
