import { describe, expect, test } from "vitest";
import { renderRssFeed } from "../src/lib/rss";

describe("renderRssFeed", () => {
  test("renders deterministic RSS XML for feed events", () => {
    const xml = renderRssFeed({
      title: "Unity Alerts - WebGL",
      siteUrl: "https://alerts.example.com",
      feedUrl: "https://alerts.example.com/rss?platform=WebGL",
      description: "Filtered Unity release events",
      events: [
        {
          stable_guid: "unity_release:abc",
          title: "Unity 6000.3.14f1",
          summary: "WebGL fixes",
          source_url: "https://unity.com/releases/editor/whats-new/6000.3.14f1",
          event_time: "2026-04-22T12:21:09.823Z",
          event_type: "unity_release",
          risk_level: "review",
          tags: ["6000.3", "WebGL"]
        }
      ]
    });

    expect(xml).toContain("<rss version=\"2.0\"");
    expect(xml).toContain("<title>Unity Alerts - WebGL</title>");
    expect(xml).toContain("<guid isPermaLink=\"false\">unity_release:abc</guid>");
    expect(xml).toContain("<category>WebGL</category>");
    expect(xml).toContain("<link>https://unity.com/releases/editor/whats-new/6000.3.14f1</link>");
  });
});
