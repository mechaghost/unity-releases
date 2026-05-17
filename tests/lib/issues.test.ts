import { describe, expect, test } from "vitest";
import { ALL_DOMAINS_PLUS_OTHER } from "../../src/lib/issues";
import { DOMAINS } from "../../src/lib/visualizer-domains";

describe("ALL_DOMAINS_PLUS_OTHER", () => {
  test("contains every curated domain plus an 'Other' fallback", () => {
    expect(ALL_DOMAINS_PLUS_OTHER.length).toBe(DOMAINS.length + 1);
    // Same prefix as the canonical domain list.
    for (let i = 0; i < DOMAINS.length; i++) {
      expect(ALL_DOMAINS_PLUS_OTHER[i]).toBe(DOMAINS[i]);
    }
    // 'Other' is the catch-all at the end.
    expect(ALL_DOMAINS_PLUS_OTHER[ALL_DOMAINS_PLUS_OTHER.length - 1]).toBe("Other");
  });

  test("does not include duplicates", () => {
    expect(new Set(ALL_DOMAINS_PLUS_OTHER).size).toBe(ALL_DOMAINS_PLUS_OTHER.length);
  });
});
