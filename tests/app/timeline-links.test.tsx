import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { describe, expect, test, vi } from "vitest";
import type { TimelineEvent } from "../../src/lib/db/repositories";

vi.mock("../../src/lib/db/repositories", () => ({
  listTimelineFeed: vi.fn()
}));

import { listTimelineFeed } from "../../src/lib/db/repositories";
import TimelinePage from "../../src/app/timeline/page";

vi.stubGlobal("React", React);

const timestamp = "2026-10-15T10:53:45.590Z";

function content(title: string, eventType = "unity_release"): Extract<TimelineEvent, { type: "content" }> {
  return {
    type: "content", id: "release", eventType, title, summary: "Release notes",
    timestamp, sourceUrl: "https://unity.com/releases/editor/whats-new/6000.6.6f1",
    tags: [], riskLevel: null
  };
}

async function render(events: TimelineEvent[]) {
  vi.mocked(listTimelineFeed).mockResolvedValue(events);
  return load(renderToStaticMarkup(await TimelinePage({ searchParams: Promise.resolve({}) })));
}

describe("timeline Editor release links", () => {
  test.each([
    ["Unity 6000.6.6f1", "6000.6.6f1"],
    ["6000.6.6f1", "6000.6.6f1"],
    ["Unity 6000.7.0b1", "6000.7.0b1"],
    ["Unity 6000.8.0a1", "6000.8.0a1"],
    ["Unity 7000.0.0f1", "7000.0.0f1"]
  ])("uses the version for every link variant of %s", async (title, version) => {
    const release = content(title);
    const $ = await render([
      release,
      {
        ...release, id: "group", eventType: "unity_release_group", title: "2 unity_release Updates",
        isGroup: true, groupItems: [release, { ...release, id: "second" }]
      },
      {
        type: "ingestion", id: "run", jobName: "backfill-unity6", sourceType: "unity_editor",
        timestamp, finishedAt: timestamp, status: "success", recordsCreated: 1,
        recordsUpdated: 0, recordsDeleted: 0, errorMessage: null, updates: [release]
      }
    ]);

    // Standalone title + notes CTA, two grouped items, and the imported update.
    const links = $('.timeline a');
    expect(links).toHaveLength(5);
    links.each((_, link) => {
      expect($(link).attr("href")).toBe(`/releases/${version}`);
      expect($(link).attr("target")).toBeUndefined();
    });
    expect($(links[0]).text()).toBe(`Editor Released: ${title}`);
    expect($(links[1]).text()).toBe("View release notes");
    expect($(links[2]).text()).toBe(title);
    expect($(links[4]).text()).toBe(title);
  });

  test("preserves package, news, and product destinations", async () => {
    const $ = await render([
      { ...content("com.unity.inputsystem 1.14.0", "package_version"), id: "package" },
      { ...content("Unity news", "blog_post"), id: "news", sourceUrl: "https://unity.com/blog/news" },
      { ...content("Unity Hub 3.14.0", "product_update"), id: "product", sourceUrl: "/updates/products/unity-hub/3.14.0" }
    ]);

    expect($('.timeline a[href="/packages?q=com.unity.inputsystem"]')).toHaveLength(1);
    expect($('.timeline a[href="https://unity.com/blog/news"][target="_blank"]')).toHaveLength(2);
    expect($('.timeline a[href="/updates/products/unity-hub/3.14.0"]')).toHaveLength(2);
  });
});
