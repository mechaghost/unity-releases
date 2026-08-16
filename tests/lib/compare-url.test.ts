import { describe, expect, test } from "vitest";
import { buildLanePageUrl, comparePreservedParams } from "../../src/lib/compare-url";
import { parseCompareStreamSelection } from "../../src/lib/stream-filter";

const LTS_AND_BETA = ["LTS", "Update/Supported", "beta"];

function query(url: string): URLSearchParams {
  return new URLSearchParams(url.slice(url.indexOf("?") + 1, url.indexOf("#")));
}

describe("buildLanePageUrl", () => {
  // The reported bug: comparing an LTS release against a 6000.6 beta with
  // the Supported + Beta chips on, then hitting a lane's Next button, used
  // to drop `?stream=` entirely. An absent `stream` resolves to LTS-only,
  // not "all streams", so the beta target fell out of scope and the page
  // rendered "No releases in range" with the chips un-highlighted.
  test("carries the stream scope onto the next page", () => {
    const current = new URLSearchParams([
      ["from", "6000.5.4f1"],
      ["to", "6000.6.0b8"],
      ["stream", "LTS"],
      ["stream", "Update/Supported"],
      ["stream", "beta"]
    ]);
    const url = buildLanePageUrl(
      current,
      { fromVersion: "6000.5.4f1", toVersion: "6000.6.0b8", streams: LTS_AND_BETA },
      "breaking",
      2
    );
    expect(query(url).getAll("stream")).toEqual(LTS_AND_BETA);
    expect(parseCompareStreamSelection(query(url).getAll("stream"))).toEqual(LTS_AND_BETA);
    expect(url).toContain("p_breaking=2");
    expect(url.endsWith("#lane-breaking")).toBe(true);
  });

  test("pins the resolved scope even when the URL carried no stream param", () => {
    const url = buildLanePageUrl(
      new URLSearchParams([["from", "6000.5.4f1"], ["to", "6000.6.0b8"]]),
      { fromVersion: "6000.5.4f1", toVersion: "6000.6.0b8", streams: ["LTS"] },
      "breaking",
      2
    );
    expect(query(url).getAll("stream")).toEqual(["LTS"]);
  });

  test("keeps user filters and the other lanes' page numbers", () => {
    const current = new URLSearchParams([
      ["from", "6000.5.4f1"],
      ["to", "6000.6.0b8"],
      ["stream", "beta"],
      ["q", "shader"],
      ["risks", "blocker,high"],
      ["platforms", "Android"],
      ["sub_from", "6000.5.5f1"],
      ["sub_to", "6000.6.0b3"],
      ["preset", "porting"],
      ["p_api", "3"],
      ["p_breaking", "2"]
    ]);
    const params = query(
      buildLanePageUrl(
        current,
        { fromVersion: "6000.5.4f1", toVersion: "6000.6.0b8", streams: ["beta"] },
        "breaking",
        3
      )
    );
    expect(params.get("q")).toBe("shader");
    expect(params.get("risks")).toBe("blocker,high");
    expect(params.get("platforms")).toBe("Android");
    expect(params.get("sub_from")).toBe("6000.5.5f1");
    expect(params.get("sub_to")).toBe("6000.6.0b3");
    expect(params.get("preset")).toBe("porting");
    expect(params.get("p_api")).toBe("3");
    expect(params.get("p_breaking")).toBe("3");
  });

  test("drops the page param when paging back to 1", () => {
    const params = query(
      buildLanePageUrl(
        new URLSearchParams([["from", "a"], ["to", "b"], ["p_breaking", "2"]]),
        { fromVersion: "a", toVersion: "b", streams: ["LTS"] },
        "breaking",
        1
      )
    );
    expect(params.has("p_breaking")).toBe(false);
  });

  test("does not accumulate stale stream values across clicks", () => {
    let current = new URLSearchParams([
      ["from", "a"],
      ["to", "b"],
      ["stream", "LTS"],
      ["stream", "beta"]
    ]);
    for (let page = 2; page <= 4; page += 1) {
      current = query(
        buildLanePageUrl(
          current,
          { fromVersion: "a", toVersion: "b", streams: ["LTS", "beta"] },
          "breaking",
          page
        )
      );
    }
    expect(current.getAll("stream")).toEqual(["LTS", "beta"]);
  });

  test("preserves a from/to resolved outside the URL", () => {
    // `from` can come from the saved-version cookie rather than the query
    // string; the pagination link still has to spell it out.
    const params = query(
      buildLanePageUrl(
        new URLSearchParams([["to", "6000.6.0b8"]]),
        { fromVersion: "6000.5.4f1", toVersion: "6000.6.0b8", streams: ["LTS"] },
        "breaking",
        2
      )
    );
    expect(params.get("from")).toBe("6000.5.4f1");
  });

  test("carries the legacy platform param and clears it when unset", () => {
    const withPlatform = query(
      buildLanePageUrl(
        new URLSearchParams([["from", "a"], ["to", "b"], ["platform", "Android"]]),
        { fromVersion: "a", toVersion: "b", platform: "Android", streams: ["LTS"] },
        "breaking",
        2
      )
    );
    expect(withPlatform.get("platform")).toBe("Android");

    const withoutPlatform = query(
      buildLanePageUrl(
        new URLSearchParams([["from", "a"], ["to", "b"], ["platform", "Android"]]),
        { fromVersion: "a", toVersion: "b", platform: "", streams: ["LTS"] },
        "breaking",
        2
      )
    );
    expect(withoutPlatform.has("platform")).toBe(false);
  });
});

describe("comparePreservedParams", () => {
  test("preserves the stream scope for the filter drawer", () => {
    const preserved = comparePreservedParams({
      fromVersion: "6000.5.4f1",
      toVersion: "6000.6.0b8",
      streams: LTS_AND_BETA
    });
    expect(preserved).toEqual([
      ["from", "6000.5.4f1"],
      ["to", "6000.6.0b8"],
      ["stream", "LTS"],
      ["stream", "Update/Supported"],
      ["stream", "beta"]
    ]);
  });

  test("round-trips through URLSearchParams without collapsing streams", () => {
    // FilterChips/FilterDrawer replay these entries with `append`; a `set`
    // would collapse the repeats down to the last stream.
    const params = new URLSearchParams();
    for (const [k, v] of comparePreservedParams({
      fromVersion: "a",
      toVersion: "b",
      streams: LTS_AND_BETA
    })) {
      params.append(k, v);
    }
    expect(params.getAll("stream")).toEqual(LTS_AND_BETA);
  });

  test("omits platform when it is empty", () => {
    const keys = comparePreservedParams({
      fromVersion: "a",
      toVersion: "b",
      platform: "",
      streams: ["LTS"]
    }).map(([k]) => k);
    expect(keys).not.toContain("platform");
  });

  test("does not carry lane pages, so a filter change resets pagination", () => {
    const keys = comparePreservedParams({
      fromVersion: "a",
      toVersion: "b",
      streams: ["LTS"]
    }).map(([k]) => k);
    expect(keys.some((k) => k.startsWith("p_"))).toBe(false);
  });
});
