import { describe, expect, test, vi } from 'vitest';
import { unityCliAdapter as adapter } from '../../src/lib/product-updates/sources/unity-cli';
import type { ProductUpdateSnapshot, ProductUpdateTargetState } from '../../src/lib/product-updates/types';
const target = adapter.manifest.targets[0];
const base = target.url;
const state = { validatedEtag: 'old', validatedLastModified: 'old' } as ProductUpdateTargetState;
// Reduced official November 13 structure; preserve version/date and note text.
const index = '---\ntitle: Unity CLI release notes\ncanonical: https://docs.unity.com/en-us/unity-cli/release-notes\n---\n\n# Unity CLI release notes\n\n[Release notes 2026](/unity-cli/release-notes/2026.md)';
const year = '---\ntitle: Unity CLI release notes for 2026\ncanonical: https://docs.unity.com/en-us/unity-cli/release-notes/2026\n---\n\n# Unity CLI release notes for 2026\n\n## [November](/unity-cli/release-notes/2026/november.md)\n\n* **Version:** [1.0.0](/unity-cli/release-notes/2026/november.md#1.0.0), **Release date:** November 12, 2026';
const month = '---\ntitle: Unity CLI release notes for November 2026\n---\n\n# Unity CLI release notes for November 2026\n\n## 1.0.0\n\n**Release date:** November 12, 2026\n\n* **Security**\n  * Each release now publishes `SHA256SUMS.asc`, a GPG signature over `SHA256SUMS` by the Unity Technologies ApS key.';
const snapshot = (text: string) => ({ text, finalUrl:base, requestedUrl:base, sourceKey:'unity-cli', targetKey:'standalone' } as ProductUpdateSnapshot);
function mockFetch(overrides: Record<string,string|number> = {}) {
  const pages: Record<string,string|number> = { [base+'.md']:index, [base+'/2026.md']:year, [base+'/2026/november.md']:month, ...overrides };
  return vi.fn<typeof fetch>(async (input, init) => {
    expect(new Headers(init?.headers).has('if-none-match')).toBe(false);
    expect(new Headers(init?.headers).has('if-modified-since')).toBe(false);
    const value = pages[String(input)];
    if (value === undefined) throw Error('Unexpected URL '+input);
    return typeof value === 'number' ? new Response('', {status:value}) : new Response(value, {headers:{'content-type':'text/markdown'}});
  });
}
async function collect(fetchImpl = mockFetch(), maxResponseBytes = 2*1024*1024) {
  const fetched = await adapter.fetch!(target,state,{fetchImpl,retries:0,timeoutMs:1000,maxResponseBytes});
  if (fetched.kind !== 'content') throw Error('Expected content');
  return { fetched, rows:adapter.parseRawSnapshot!(snapshot(fetched.text)), fetchImpl };
}
describe('CLI replayable monthly history', () => {
  test('fetches complete notes, keeps identities, and replays without network', async () => {
    const {fetched,rows,fetchImpl}=await collect();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(rows[0]).toMatchObject({sourceUpdateKey:'1.0.0',channel:'stable',releaseDate:'2026-11-12T00:00:00.000Z',sourceUrl:base+'/2026/november#1.0.0'});
    expect(rows[0].items[0].body).toContain('`SHA256SUMS.asc`');
    expect(adapter.parseRawSnapshot!(snapshot(fetched.text))).toEqual(rows);
    const bundle=JSON.parse(fetched.text);bundle.months=[];
    expect(()=>adapter.parseRawSnapshot!(snapshot(JSON.stringify(bundle)))).toThrow();
  });
  test('hashes child changes even when the indexes are unchanged', async () => {
    const first = await collect();
    const second = await collect(mockFetch({[base+'/2026/november.md']:month+'\n  * Additional published note.'}));
    expect(second.fetched.sha256).not.toBe(first.fetched.sha256);
    expect(second.rows[0].items.length).toBeGreaterThan(first.rows[0].items.length);
  });
  test('retains the previous single-page layout', async () => {
    const old='# Unity command-line interface (CLI) release notes\n\n## November 12, 2026\n\n### 1.0.0\n\n* Original note';
    const {rows,fetchImpl}=await collect(mockFetch({[base+'.md']:old}));
    expect(rows).toHaveLength(1);expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  test.each([
    month.replace('November 12, 2026','November 31, 2026'),
    month.replace('## 1.0.0','## 1.0.1'),
    month.replaceAll('November 2026','October 2026'),
    month.split('* **Security**')[0],
    month+'\n\n## 1.0.0\n\n**Release date:** November 12, 2026\n\n* Duplicate'
  ])('rejects malformed, partial, or duplicate month content', async value => {
    await expect(collect(mockFetch({[base+'/2026/november.md']:value}))).rejects.toThrow();
  });
  test('rejects missing children, hostile links and aggregate overflow', async () => {
    await expect(collect(mockFetch({[base+'/2026/november.md']:503}))).rejects.toThrow();
    const fetchImpl=mockFetch({[base+'.md']:index.replace('/unity-cli/release-notes/2026.md','https://evil.test/unity-cli/release-notes/2026.md')});
    await expect(collect(fetchImpl)).rejects.toThrow();expect(fetchImpl).toHaveBeenCalledTimes(1);
    await expect(collect(mockFetch(),Buffer.byteLength(index)+10)).rejects.toThrow();
  });
});
