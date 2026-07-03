import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * The stylesheet defines dark-theme tokens twice: once for the explicit
 * toggle (`[data-theme="dark"]`) and once for OS preference
 * (`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }`).
 * The media block has higher specificity, so any token that drifts there
 * silently overrides the toggle block for OS-dark visitors — that's how
 * `--text-muted` shipped at a failing 3.55:1 contrast for months while
 * the "fixed" value sat unused in the toggle block.
 *
 * This test parses both blocks and asserts identical token maps.
 */

const css = readFileSync(join(process.cwd(), "src/app/styles.css"), "utf8");

/** Extract `--token: value;` pairs from the body of a block that starts
 *  at the first `{` after `selectorStart` and ends at its matching `}`. */
function tokensAfter(selectorStart: number): Map<string, string> {
  const open = css.indexOf("{", selectorStart);
  let depth = 0;
  let end = open;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = css.slice(open + 1, end);
  const map = new Map<string, string>();
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    map.set(match[1], match[2].replace(/\s+/g, " ").trim());
  }
  return map;
}

describe("dark theme token parity", () => {
  const toggleStart = css.indexOf('[data-theme="dark"]');
  const mediaStart = css.indexOf(':root:not([data-theme="light"])');

  test("both dark blocks exist", () => {
    expect(toggleStart).toBeGreaterThan(-1);
    expect(mediaStart).toBeGreaterThan(-1);
  });

  test("OS-preference dark block defines the same tokens as the toggle block", () => {
    const toggle = tokensAfter(toggleStart);
    const media = tokensAfter(mediaStart);

    const toggleOnly = [...toggle.keys()].filter((k) => !media.has(k));
    const mediaOnly = [...media.keys()].filter((k) => !toggle.has(k));
    expect(toggleOnly, "tokens missing from the media block").toEqual([]);
    expect(mediaOnly, "tokens missing from the toggle block").toEqual([]);

    const diverged = [...toggle.entries()]
      .filter(([k, v]) => media.get(k) !== v)
      .map(([k, v]) => `${k}: toggle="${v}" media="${media.get(k)}"`);
    expect(diverged, "token values drifted between the two dark blocks").toEqual([]);
  });

  test("dark --text-muted keeps its AA-passing value", () => {
    const toggle = tokensAfter(toggleStart);
    expect(toggle.get("--text-muted")).toBe("#A19A8E");
  });
});
