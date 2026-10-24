import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { markdownToHtml, repairUnityDocsTables } from "../../src/lib/product-updates/markdown";
import { markdownTwinUrl } from "../../src/lib/product-updates/fetcher";
import {
  PRODUCT_UPDATE_ADAPTERS,
  findProductUpdateAdapter
} from "../../src/lib/product-updates/sources/index";
import { validateObservations } from "../../src/lib/product-updates/validation";
import type {
  ProductUpdateAdapter,
  ProductUpdateSnapshot
} from "../../src/lib/product-updates/types";

/**
 * docs.unity.com went client-rendered: the served HTML carries no
 * h1/h2/h3 at all, so every adapter reading it threw "root heading is
 * missing" and the crons failed. The adapters now read the `<url>.md`
 * twin rendered back to HTML. These fixtures are real captured markdown
 * (scripts/capture-product-update-fixtures.mjs) so the suite exercises
 * the bytes Unity actually serves.
 */
describe("docs.unity.com markdown pipeline", () => {
  test("requests the .md twin for markdown targets and leaves others alone", () => {
    const cli = findProductUpdateAdapter("unity-cli")!.manifest.targets[0];
    expect(markdownTwinUrl(cli)).toBe(
      "https://docs.unity.com/en-us/unity-cli/release-notes.md"
    );

    const hub = findProductUpdateAdapter("unity-hub")!.manifest.targets[0];
    expect(hub.documentFormat).toBeUndefined();
    expect(markdownTwinUrl(hub)).toBe(hub.url);
  });

  test("every docs.unity.com target is declared markdown", () => {
    // A target left on the HTML path silently returns a heading-less
    // document and quarantines its source on the next cron run.
    const stragglers = PRODUCT_UPDATE_ADAPTERS.flatMap((adapter) =>
      adapter.manifest.targets
        .filter(
          (target) =>
            new URL(target.url).hostname === "docs.unity.com" &&
            target.documentFormat !== "markdown"
        )
        .map((target) => `${adapter.manifest.sourceKey}/${target.targetKey}`)
    );
    expect(stragglers).toEqual([]);
  });

  test("renders headings and nested lists into the DOM adapters expect", () => {
    const html = markdownToHtml(
      "# Root\n\n## August 21, 2026\n\n### 1.0.0-beta.6\n\n* **Breaking changes**\n  * `unity bug` now requires sign-in.\n"
    );
    expect(html).toContain("<h1>Root</h1>");
    expect(html).toContain("<h2>August 21, 2026</h2>");
    expect(html).toContain("<h3>1.0.0-beta.6</h3>");
    expect(html).toContain("<strong>Breaking changes</strong>");
    expect(html).toContain("<code>unity bug</code>");
    // Nested bullets must stay nested; flattening them merges a category
    // heading into its own items.
    expect(html).toMatch(/<ul>[\s\S]*<ul>/);
  });

  describe("repairUnityDocsTables", () => {
    // Unity's exporter has no GFM syntax for a multi-line cell, so it puts
    // the first line in the row and dumps the rest as bare lines after it.
    // marked closed the table there: LevelPlay kept 1 of 124 rows and
    // Unity Ads iOS lost 34 of 65. Both were caught by the record floors.
    const table = [
      "| SDK Version | Release Date | Notes",
      "| ----------- | ------------ | -----",
      "| 9.6.0       | 2026/08/13   | * Improved init resilience.",
      "* Reduced init time.",
      "  * Nested detail line.",
      "",
      "- Fixed a crash in `Foo|Bar`.",
      "| 9.5.0       | 2026/07/01   | 1. Updated the GDPR API.",
      "Run-on prose continues the cell.",
      "| 9.4.4       | 2026/06/17   | * Single-line row."
    ].join("\n");

    test("folds every continuation line back into its row", () => {
      const rows = repairUnityDocsTables(table).split("\n").filter((l) => l.startsWith("| 9."));
      expect(rows).toHaveLength(3);
      expect(rows[0]).toBe(
        "| 9.6.0       | 2026/08/13   | Improved init resilience. Reduced init time. Nested detail line. Fixed a crash in `Foo\\|Bar`. |"
      );
      expect(rows[1]).toBe("| 9.5.0       | 2026/07/01   | Updated the GDPR API. Run-on prose continues the cell. |");
      expect(rows[2]).toBe("| 9.4.4       | 2026/06/17   | Single-line row. |");
    });

    test("renders as one table with one <tr> per row after the fold", () => {
      const html = markdownToHtml(table);
      expect(html.match(/<table>/g)).toHaveLength(1);
      expect(html.match(/<tr>/g)).toHaveLength(4); // header + 3 rows
      expect(html).toContain("<td>9.5.0</td>");
      // The escaped pipe survives as a literal in the cell, not a split.
      expect(html).toContain("Foo|Bar");
    });

    test("a heading ends the table so later prose is never folded", () => {
      const md = `${table}\n\n## Version 4.18.1 - released 2026-05-28\n\nThis paragraph belongs to the heading.`;
      const out = repairUnityDocsTables(md);
      expect(out).toContain("\n## Version 4.18.1 - released 2026-05-28\n");
      expect(out).toContain("\nThis paragraph belongs to the heading.");
      expect(out.split("\n").filter((l) => l.startsWith("| 9."))[2]).toBe(
        "| 9.4.4       | 2026/06/17   | Single-line row. |"
      );
    });

    test("leaves markdown with no tables byte-identical", () => {
      const md = "# Root\n\n## Aug 21, 2026\n\n### 1.0.0\n\n* one\n  * two\n\nprose | with a pipe\n";
      expect(repairUnityDocsTables(md)).toBe(md);
    });

    test("removes a continuation's closing delimiter without stripping literal backslashes", () => {
      const md = "| Version | Notes |\n| --- | --- |\n| 1.0 | First note.\n* Use `C:\\Tools` and `Foo|Bar`. |";
      const html = markdownToHtml(md);
      expect(html).toContain("<td>First note. Use <code>C:\\Tools</code> and <code>Foo|Bar</code>.</td>");
    });

    test("prose between the delimiter row and the first data row is kept, not folded", () => {
      const md = "| A | B\n| - | -\nintro line\n| 1 | x\n* more x";
      const out = repairUnityDocsTables(md);
      expect(out).toContain("\nintro line\n");
      expect(out).toContain("| 1 | x more x |");
    });
  });

  const CASES: Array<{
    fixture: string;
    sourceKey: string;
    targetKey: string;
    minObservations: number;
    expect?: (observations: ReturnType<ProductUpdateAdapter["parse"]>) => void;
  }> = [
    {
      fixture: "unity-cli",
      sourceKey: "unity-cli",
      targetKey: "standalone",
      minObservations: 10,
      expect: (observations) => {
        const beta6 = observations.find((o) => o.version === "1.0.0-beta.6");
        expect(beta6).toBeDefined();
        expect(beta6!.channel).toBe("beta");
        expect(beta6!.releaseDate).toBe("2026-08-21T00:00:00.000Z");
        expect(beta6!.items.some((i) => i.section === "Breaking changes")).toBe(true);
        // Reader-facing link, not the .md twin.
        expect(beta6!.sourceUrl).not.toContain(".md");
      }
    },
    {
      fixture: "vpc-aws-1-2",
      sourceKey: "vpc-aws",
      targetKey: "1-2",
      minObservations: 3
    },
    { fixture: "vpctl", sourceKey: "vpctl", targetKey: "cli", minObservations: 5 },
    // Exact counts: the pre-migration Sep 2 cron recorded 29 / 67 / 65 for
    // these three targets. Anything lower means rows are being lost again.
    {
      fixture: "unity-ads-unity",
      sourceKey: "unity-ads-unity",
      targetKey: "unity",
      minObservations: 29,
      expect: (o) => expect(o).toHaveLength(29)
    },
    {
      fixture: "unity-ads-unity",
      sourceKey: "unity-ads-android",
      targetKey: "android",
      minObservations: 67,
      expect: (o) => expect(o).toHaveLength(67)
    },
    {
      fixture: "unity-ads-unity",
      sourceKey: "unity-ads-ios",
      targetKey: "ios",
      minObservations: 65,
      expect: (o) => expect(o).toHaveLength(65)
    },
    {
      fixture: "levelplay-unity",
      sourceKey: "levelplay-unity",
      targetKey: "unity",
      minObservations: 148,
      expect: (observations) => {
        expect(observations).toHaveLength(148);
        for (const [version, date] of [
          ["9.3.2", "2026-09-25"],
          ["9.3.1", "2026-09-10"],
          ["9.5.1", "2026-08-19"]
        ]) {
          const release = observations.find((o) => o.version === version)!;
          expect(release).toBeDefined();
          expect(release.releaseDate).toBe(`${date}T00:00:00.000Z`);
          expect(release.summary).not.toContain("\\");
          expect(release.items[0].body).toBe(release.summary);
        }
        expect(observations.find((o) => o.version === "9.3.2")!.summary).toBe(
          "Wraps Android 9.6.0 SDK and iOS 9.6.0 SDK. (iOS) Fixed the LevelPlay.SetNetworkData API so the network key is now passed correctly to the native SDK. This completes the fix released in 9.3.1."
        );
      }
    },
    {
      fixture: "levelplay-android",
      sourceKey: "levelplay-android",
      targetKey: "android",
      minObservations: 124,
      expect: (o) => {
        expect(o).toHaveLength(124);
        const top = o.find((x) => x.version === "9.6.0")!;
        // The folded cell reads like the old <td><ul><li> text: no markers.
        expect(top.items[0].body).toContain("Reduced SDK initialization time.");
        expect(top.items[0].body).not.toMatch(/(^|\s)[*-]\s/);
      }
    },
    {
      fixture: "licensing-server",
      sourceKey: "licensing-server",
      targetKey: "server",
      minObservations: 3
    },
    {
      fixture: "vivox-core",
      sourceKey: "vivox-core",
      targetKey: "core",
      minObservations: 3
    }
  ];

  for (const testCase of CASES) {
    test(`parses real ${testCase.fixture} markdown end to end`, () => {
      const adapter = findProductUpdateAdapter(testCase.sourceKey);
      expect(adapter, `missing adapter ${testCase.sourceKey}`).toBeTruthy();
      const markdown = readFixture(`${testCase.fixture}.md`);
      // Guard the fixture itself: an HTML error page captured by mistake
      // would otherwise parse to zero observations and read as drift.
      expect(markdown).toMatch(/^#\s+\S/m);

      const observations = validateObservations(
        adapter!.parse(snapshot(adapter!, testCase.targetKey, markdownToHtml(markdown))),
        { ...adapter!.manifest, minimumExpectedRecords: 1 },
        null
      );
      expect(observations.length).toBeGreaterThanOrEqual(testCase.minObservations);
      expect(observations.every((o) => o.items.length > 0)).toBe(true);
      testCase.expect?.(observations);
    });
  }

  test("table repair handles long whitespace runs and preserves content pipes", () => {
    const content = "start" + " ".repeat(20_000) + "end";
    const escapedPipe = String.fromCharCode(92) + "|";
    const repaired = repairUnityDocsTables(`| Version | Notes
| --- | ---
| 1.0 | ${content}
continued Foo|Bar |`);
    expect(repaired).toContain(`${content} continued Foo${escapedPipe}Bar |`);
  });

  test("raw markdown never reaches a parser", () => {
    // The conversion lives in the runner, so a target wired straight to the
    // markdown would throw rather than silently produce nothing.
    const adapter = findProductUpdateAdapter("unity-cli")!;
    expect(() =>
      adapter.parse(snapshot(adapter, "standalone", readFixture("unity-cli.md")))
    ).toThrow(/root heading/i);
  });
});

function readFixture(name: string) {
  return readFileSync(
    new URL(`../fixtures/product-updates/markdown/${name}`, import.meta.url),
    "utf8"
  );
}

function snapshot(
  adapter: ProductUpdateAdapter,
  targetKey: string,
  text: string
): ProductUpdateSnapshot {
  const target = adapter.manifest.targets.find((t) => t.targetKey === targetKey);
  if (!target) throw new Error(`Missing fixture target ${targetKey}`);
  return {
    sourceKey: adapter.manifest.sourceKey,
    targetKey,
    requestedUrl: target.url,
    finalUrl: target.url,
    fetchedAt: "2026-09-03T00:00:00.000Z",
    status: 200,
    etag: null,
    lastModified: null,
    sha256: "fixture",
    text
  };
}
