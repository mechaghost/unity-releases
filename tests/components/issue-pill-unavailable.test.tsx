import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { describe, expect, test, vi } from "vitest";
import { IssuePill } from "../../src/app/_components/IssuePill";
import { ExternalLink } from "../../src/app/_components/ExternalLink";
import { resolveExternalLink } from "../../src/lib/external-links";
import { renderChangelog } from "../../src/lib/changelog-markdown";
import { changelogLinks } from "../../src/lib/changelog-links";
import { classifyLink } from "../../src/lib/link-audit";

vi.mock("../../src/app/_components/HoverInfo", () => ({
  HoverInfo: ({ children, body, footer }: { children: React.ReactNode; body: React.ReactNode; footer: React.ReactNode }) => <>{children}<div data-hover-body>{body}</div><div data-hover-footer>{footer}</div></>
}));

const dead = "https://issuetracker.unity3d.com/issues/particles-calling-setdirty-from-a-thread-causes-crashes";
const official = "https://unity.com/releases/editor/whats-new/2022.3.13f1";

describe("confirmed unavailable UUM-54561 source", () => {
  test.each([false, true])("retains the issue chip and original URL without a dead anchor (compact=%s)", compact => {
    const $ = load(renderToStaticMarkup(<IssuePill id="UUM-54561" url={dead} compact={compact} />));
    expect($(".chip--issue").text()).toContain("UUM-54561");
    expect($(".chip--issue").text()).toContain("Source unavailable");
    expect($(".chip--issue").attr("title")).toContain(dead);
    expect($(`a[href="${dead}"]`)).toHaveLength(0);
    if (!compact) {
      expect($(".chip--issue").attr("tabindex")).toBe("0");
      expect($("a[href='/issues/UUM-54561']").length).toBeGreaterThan(0);
      expect($("[data-hover-footer]").text()).toContain("Source unavailable");
      expect($("[data-hover-footer]").text()).toContain("All mentions of UUM-54561");
    }
  });

  test("keeps other issue destinations and ID-only search links active", () => {
    const good = "https://issuetracker.unity3d.com/issues/crash-on-internalabp-boxmanager-preparedata-when-entering-play-mode";
    const $ = load(renderToStaticMarkup(<><IssuePill id="UUM-49807" url={good} /><IssuePill id="UUM-54561" /></>));
    expect($(`a[href="${good}"]`)).toHaveLength(2);
    expect($("a[href='https://issuetracker.unity.com/?q=UUM-54561']")).toHaveLength(2);
    expect($.text()).not.toContain("Source unavailable");
    expect(resolveExternalLink(`${dead}-unreviewed`).href).toBe(`${dead}-unreviewed`);
  });

  test("preserves historical changelog text and the official release source", () => {
    const notes = `Fixed regression that was causing a crash in ParticleSystem Stop() when called outside of main thread. ([UUM-54561](${dead}))`;
    const $ = load(renderToStaticMarkup(<>{renderChangelog(notes)}<ExternalLink href={official}>Unity release page</ExternalLink></>));
    expect($.text()).toContain("Fixed regression that was causing a crash in ParticleSystem Stop() when called outside of main thread.");
    expect($.text()).toContain("UUM-54561");
    expect($(`[title*="${dead}"]`).length).toBeGreaterThan(0);
    expect($(`a[href="${official}"]`)).toHaveLength(1);
    expect(changelogLinks(notes)).toEqual([]);
    expect(resolveExternalLink(`${dead}/#details`).href).toBeNull();
  });

  test("does not teach the checker to ignore confirmed unavailable destinations", () => {
    expect(classifyLink({status:200,finalUrl:"https://issuetracker.unity.com/not-found",contentType:"text/html",body:"<title>Unity Issue Tracker - Page Not Found</title>"})).toBe("broken");
  });
});
