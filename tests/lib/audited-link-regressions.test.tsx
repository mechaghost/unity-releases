import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { NoteRow } from "../../src/app/_components/NoteRow";
import { resolveExternalLink } from "../../src/lib/external-links";
import { normalizeIssueTrackerHref } from "../../src/lib/issue-tracker-links";

vi.mock("../../src/lib/db/client", () => ({query:vi.fn(async()=>({rows:[{version:"6000.3.27f1"}]}))}));
vi.mock("../../src/app/_components/HoverInfo",()=>({HoverInfo:({children}:{children:React.ReactNode})=><>{children}</>}));

// Read the audit's immutable destination column, not a second hand-maintained
// list. This protects every confirmed broken link, including old stored URLs.
const urls=readFileSync(new URL("../../docs/audits/2026-10-24-site-audit/broken-links.csv",import.meta.url),"utf8")
  .trim().split("\n").slice(1).map(line=>/^"([^"]+)"/.exec(line)![1]);

describe("2026-10-24 confirmed broken-link regressions",()=>{
  test("all audited release references stay nonlinks when absent from the index",async()=>{
    const versions=urls.filter(url=>new URL(url).origin==="https://unityreleases.com").map(url=>new URL(url).pathname.split("/").at(-1)!);
    expect(versions).toHaveLength(43);
    const html=renderToStaticMarkup(await NoteRow({row:{id:1,version:"6000.3.27f1",section:"Fixes",area:null,body:versions.join(", "),impact_kind:"fix",risk_level:"info",platforms:[],package_names:[],issue_ids:[],issue_links_json:[]}}));
    for(const version of versions){expect(html).toContain(version);expect(html).not.toContain(`href="/releases/${version}"`);}
  });
  test("every external audit failure is either repaired tracker search or clearly unavailable",()=>{
    const external=urls.filter(url=>new URL(url).origin!=="https://unityreleases.com");
    expect(external).toHaveLength(64);
    for(const url of external){
      if(new URL(url).hostname.startsWith("issuetracker.")){
        const fixed=new URL(normalizeIssueTrackerHref(url));
        expect(fixed.origin).toBe("https://issuetracker.unity.com");
        expect(fixed.pathname).toBe("/");
        expect(fixed.searchParams.get("q")).toMatch(/^UUM-\d+$/);
        expect(fixed.searchParams.has("search")).toBe(false);
      }else{expect(resolveExternalLink(url).href).toBeNull();}
    }
  });
});
