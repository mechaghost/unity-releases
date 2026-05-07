import { describe, expect, test } from "vitest";
import {
  compareControlUrl,
  isCompareLaneOpen,
  toggleCompareLaneOpenUrl,
  toggleCompareTopicUrl
} from "../../src/lib/compare-controls";

const defaultOpenLane = { id: "blockers", defaultOpen: true };
const defaultClosedLane = { id: "package", defaultOpen: false };

describe("compare control URLs", () => {
  test("toggles lane visibility without adding a jump hash", () => {
    const href = toggleCompareLaneOpenUrl({
      fromVersion: "6000.3.2f1",
      toVersion: "6000.4.3f1",
      platform: "",
      expanded: new Set(),
      topicFilter: new Set(["package"]),
      lane: defaultOpenLane
    });

    expect(href).toBe("/compare?from=6000.3.2f1&to=6000.4.3f1&expand=%21blockers&topics=package");
  });

  test("toggles topic filters without adding a jump hash", () => {
    const href = toggleCompareTopicUrl({
      fromVersion: "6000.3.2f1",
      toVersion: "6000.4.3f1",
      platform: "",
      expanded: new Set(["package"]),
      topicFilter: new Set(["package"]),
      laneId: "api"
    });

    expect(href).toBe("/compare?from=6000.3.2f1&to=6000.4.3f1&expand=package&topics=package%2Capi");
  });

  test("removes the last selected topic to return to all lanes", () => {
    const href = toggleCompareTopicUrl({
      fromVersion: "6000.3.2f1",
      toVersion: "6000.4.3f1",
      platform: "Android",
      expanded: new Set(),
      topicFilter: new Set(["package"]),
      laneId: "package"
    });

    expect(href).toBe("/compare?from=6000.3.2f1&to=6000.4.3f1&platform=Android");
  });

  test("only explicit jump URLs include a hash", () => {
    const href = compareControlUrl({
      fromVersion: "6000.3.2f1",
      toVersion: "6000.4.3f1",
      platform: "",
      expanded: new Set(),
      topicFilter: new Set(["breaking"]),
      hash: "lane-breaking"
    });

    expect(href).toBe("/compare?from=6000.3.2f1&to=6000.4.3f1&topics=breaking#lane-breaking");
  });

  test("tracks default-open and default-closed lane state", () => {
    expect(isCompareLaneOpen(defaultOpenLane, new Set())).toBe(true);
    expect(isCompareLaneOpen(defaultOpenLane, new Set(["!blockers"]))).toBe(false);
    expect(isCompareLaneOpen(defaultClosedLane, new Set())).toBe(false);
    expect(isCompareLaneOpen(defaultClosedLane, new Set(["package"]))).toBe(true);
  });
});
