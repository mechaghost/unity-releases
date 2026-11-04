import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { NoteRow, type NoteRowData } from "../../src/app/_components/NoteRow";

vi.mock("../../src/lib/db/client", () => ({
  query: vi.fn(async () => ({ rows: [{version:"6000.3.27f1"}] }))
}));
vi.mock("../../src/app/_components/HoverInfo", () => ({
  HoverInfo: ({children}: {children: React.ReactNode}) => <>{children}</>
}));

function note(overrides: Partial<NoteRowData> = {}): NoteRowData {
  return {id:1,version:"6000.3.27f1",section:"Fixes",area:null,body:"Fixed in 6000.3.27f1; backported to 7000.0.0a13.",impact_kind:"fix",risk_level:"info",platforms:[],package_names:[],issue_ids:[],issue_links_json:[],...overrides};
}

describe("release-note links only target indexed builds", () => {
  test("inline known versions link while future/unindexed builds stay readable text", async () => {
    const html=renderToStaticMarkup(await NoteRow({row:note()}));
    expect(html).toContain('href="/releases/6000.3.27f1"');
    expect(html).toContain('7000.0.0a13');
    expect(html).not.toContain('href="/releases/7000.0.0a13"');
  });
  test("known-issue leading versions and backport area lists use the same guard", async () => {
    const html=renderToStaticMarkup(await NoteRow({row:note({section:"Known Issues",impact_kind:"known_issue",body:"7000.0.0a13: Crash while building.",area:"6000.3.27f1,7000.0.0a14"})}));
    expect(html).toContain('href="/releases/6000.3.27f1"');
    expect(html).toContain('7000.0.0a13');
    expect(html).toContain('7000.0.0a14');
    expect(html).not.toMatch(/href="\/releases\/7000\./);
  });
});

test("UUM-54561's stored release-note text and history survive its unavailable source", async () => {
  const url = "https://issuetracker.unity3d.com/issues/particles-calling-setdirty-from-a-thread-causes-crashes";
  const body = "Fixed regression that was causing a crash in ParticleSystem Stop() when called outside of main thread.";
  const row = note({version:"2022.3.13f1",body,area:"Particles",issue_ids:["UUM-54561"],issue_links_json:[{id:"UUM-54561",url}]});
  const original = JSON.stringify(row);
  const html = renderToStaticMarkup(await NoteRow({row}));
  expect(html).toContain(body);
  expect(html).toContain("UUM-54561");
  expect(html).toContain("Source unavailable");
  expect(html).toContain(`Original URL: ${url}`);
  expect(html).not.toContain(`href="${url}"`);
  expect(html).toContain('href="/issues/UUM-54561"');
  expect(JSON.stringify(row)).toBe(original);
});
