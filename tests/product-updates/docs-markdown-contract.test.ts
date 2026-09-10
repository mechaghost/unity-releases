/**
 * Contract test against docs.unity.com's live markdown twins.
 *
 * docs.unity.com is client-rendered: the served HTML carries no h1/h2/h3,
 * so every adapter that reads it depends entirely on `<url>.md` returning
 * `text/markdown`. That dependency is invisible until it breaks - the day
 * Unity drops the twins, sixteen targets start throwing "root heading is
 * missing" and four crons go red at once, exactly as they did when the
 * site first moved to client rendering.
 *
 * So this asserts the contract directly. It is opt-in - the suite must
 * stay green offline and in CI without network:
 *
 *   UNITY_DOCS_CONTRACT=1 npx vitest run tests/product-updates/docs-markdown-contract.test.ts
 */

import { describe, expect, test } from "vitest";
import { markdownTwinUrl } from "../../src/lib/product-updates/fetcher";
import { markdownToHtml } from "../../src/lib/product-updates/markdown";
import { PRODUCT_UPDATE_ADAPTERS } from "../../src/lib/product-updates/sources/index";
import { validateObservations } from "../../src/lib/product-updates/validation";
import type { ProductUpdateTargetManifest } from "../../src/lib/product-updates/types";

const ENABLED = process.env.UNITY_DOCS_CONTRACT === "1";
const TIMEOUT_MS = 45_000;

// Retired targets stay on the manifest so their DB row flips to
// manually-retired, but the runner returns skipped-retired for them and
// never parses them. Probing one here reported drift for a page nobody
// reads - vpc-aws/aws, the pre-split index, is now just a list of links
// to the per-version pages and has no version sections by design. A
// contract test that cries wolf gets ignored, so it must test exactly
// what production runs.
const MARKDOWN_TARGETS = PRODUCT_UPDATE_ADAPTERS.flatMap((adapter) =>
  adapter.manifest.targets
    .filter((target) => target.documentFormat === "markdown" && !target.retired)
    .map((target) => ({ adapter, target }))
);

describe.runIf(ENABLED)("docs.unity.com markdown contract", () => {
  test("skips retired targets, matching what the runner actually parses", () => {
    const probed = new Set(
      MARKDOWN_TARGETS.map((t) => `${t.adapter.manifest.sourceKey}/${t.target.targetKey}`)
    );
    expect(probed.has("vpc-aws/1-4")).toBe(true);
    expect(probed.has("vpc-aws/aws")).toBe(false);
  });

  test("every markdown target still serves a parseable twin", async () => {
    expect(MARKDOWN_TARGETS.length).toBeGreaterThan(0);
    const failures: string[] = [];

    for (const { adapter, target } of MARKDOWN_TARGETS) {
      const key = `${adapter.manifest.sourceKey}/${target.targetKey}`;
      try {
        const response = await fetch(markdownTwinUrl(target as ProductUpdateTargetManifest), {
          headers: { accept: "text/markdown,text/plain" },
          signal: AbortSignal.timeout(TIMEOUT_MS)
        });
        if (!response.ok) {
          failures.push(`${key}: HTTP ${response.status}`);
          continue;
        }
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("text/markdown")) {
          failures.push(`${key}: content-type ${contentType}`);
          continue;
        }
        const observations = validateObservations(
          adapter.parse({
            sourceKey: adapter.manifest.sourceKey,
            targetKey: target.targetKey,
            requestedUrl: target.url,
            finalUrl: target.url,
            fetchedAt: new Date().toISOString(),
            status: 200,
            etag: null,
            lastModified: null,
            sha256: "contract",
            text: markdownToHtml(await response.text())
          }),
          { ...adapter.manifest, minimumExpectedRecords: 1 },
          null
        );
        if (observations.length === 0) failures.push(`${key}: zero observations`);
      } catch (error) {
        failures.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    expect(failures, `docs.unity.com drift:\n${failures.join("\n")}`).toEqual([]);
  }, TIMEOUT_MS * MARKDOWN_TARGETS.length);
});
