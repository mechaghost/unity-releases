import { beforeEach, expect, test, vi } from "vitest";
const mocks=vi.hoisted(()=>({fetchText:vi.fn(),query:vi.fn()}));
vi.mock("../../src/lib/ingest/fetch",()=>({fetchText:mocks.fetchText}));
vi.mock("../../src/lib/db/client",()=>({query:mocks.query}));
vi.mock("../../src/lib/ingest/unity-packages",()=>({UNITY_OFFICIAL_PACKAGES:["com.unity.entities"]}));
import { main } from "../../src/jobs/poll-package-docs";
beforeEach(()=>{vi.resetAllMocks();mocks.query.mockResolvedValue({rows:[{major:"6000",minor:"7"}]});});
test.each([200,401,403,429,503])("documentation HTTP %s preserves rows and fails whole job",async(status)=>{
 mocks.fetchText.mockResolvedValue({status,text:"Unavailable"});
 await expect(main()).rejects.toThrow("incomplete for 1 packages");
 expect(mocks.query.mock.calls.some(([sql])=>sql.includes("DELETE"))).toBe(false);
});
test("database target lookup failure cannot fall back and delete newer package data",async()=>{
 mocks.query.mockRejectedValue(new Error("timeout"));
 await expect(main()).rejects.toThrow("Cannot select package documentation target versions");
 expect(mocks.fetchText).not.toHaveBeenCalled();
});

test("failure probing a newer minor cannot downgrade to an older aligned version",async()=>{
  mocks.query.mockResolvedValue({rows:[{major:"6000",minor:"7"},{major:"6000",minor:"6"}]});
  mocks.fetchText.mockResolvedValueOnce({status:503,text:"Unavailable"})
    .mockResolvedValueOnce({status:200,text:'<h2>[6.6.0] - 2026-09-01</h2><p>Changes</p>'});
  await expect(main()).rejects.toThrow("incomplete for 1 packages");
  expect(mocks.query.mock.calls.some(([sql])=>/INSERT|DELETE/.test(sql))).toBe(false);
});

test('unrecognized changelog diagnostics identify package, minor, URL and HTTP cause',async()=>{
 const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
 const url='https://docs.unity3d.com/Packages/com.unity.entities@6.7/changelog/CHANGELOG.html';
 mocks.fetchText.mockResolvedValue({status:200,text:'Unavailable',finalUrl:url});
 await expect(main()).rejects.toThrow('incomplete for 1 packages');
 expect(warn.mock.calls.map(([line])=>JSON.parse(line))).toContainEqual(expect.objectContaining({
  event:'package_docs_probe',pkg:'com.unity.entities',minor:'6.7',url,finalUrl:url,httpStatus:200,
  outcome:'uncertain',reason:'unrecognized_changelog'
 }));
 warn.mockRestore();
});

test('same-minor latest redirect remains uncertain without an actual changelog', async()=>{
 const pkg='com.unity.entities';
 mocks.fetchText.mockResolvedValue({status:200,finalUrl:`https://docs.unity3d.com/Packages/${pkg}@latest/`,
  text:`<title>Redirecting to latest version of ${pkg}</title><body><a href='../${pkg}@6.7/index.html'>follow this link</a></body>`});
 await expect(main()).rejects.toThrow('incomplete for 1 packages');
 expect(mocks.query.mock.calls.some(([sql])=>/INSERT|DELETE/.test(sql))).toBe(false);
});

test('verified migrated manual is not aligned across all affected minors', async()=>{
 const { readFileSync } = await import('node:fs');
 const { probePackage } = await import('../../src/jobs/poll-package-docs');
 const finalUrl='https://docs.unity.com/en-us/engine/6000.6/manual/packages-list/upm-ui-window/upm-ui';
 const text=readFileSync('tests/fixtures/package-docs/package-manager-manual-migrated.html','utf8');
 mocks.fetchText.mockResolvedValue({status:200,finalUrl,text});
 await expect(probePackage('com.unity.package-manager-ui',['6.6','6.5','6.4','6.3'])).resolves.toEqual({status:'not-aligned'});
 expect(mocks.fetchText).toHaveBeenCalledTimes(4);
 expect(mocks.query).not.toHaveBeenCalled();
 mocks.fetchText.mockResolvedValue({status:200,finalUrl,text:'<h1>Unavailable</h1>'});
 await expect(probePackage('com.unity.package-manager-ui',['6.6'])).resolves.toEqual({status:'uncertain'});
});
