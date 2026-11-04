import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { unityVersionControlAdapter as adapter } from '../../src/lib/product-updates/sources/unity-version-control';
import { validateObservations } from '../../src/lib/product-updates/validation';
import type { ProductUpdateSnapshot, ProductUpdateTargetState } from '../../src/lib/product-updates/types';

const target = adapter.manifest.targets[0];
const state = { validatedEtag: 'old-index-etag', validatedLastModified: 'old-date' } as ProductUpdateTargetState;
const fixture = (name: string) => readFileSync(new URL(`../fixtures/product-updates/markdown/uvcs-years/${name}.md`, import.meta.url), 'utf8');
const snapshot = (text: string): ProductUpdateSnapshot => ({sourceKey: adapter.manifest.sourceKey, targetKey: target.targetKey, requestedUrl: target.url, finalUrl: target.url, fetchedAt: '2026-11-04T00:00:00Z', status: 200, etag: null, lastModified: null, sha256: 'test', text});
function mockFetch(overrides: Record<string,string|number> = {}) {
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    const name = url === `${target.url}.md` ? 'index' : url.match(/\/(20\d{2})\.md$/)?.[1];
    if (!name) throw new Error(`Unexpected URL ${url}`);
    expect(new Headers(init?.headers).has('if-none-match')).toBe(false);
    expect(new Headers(init?.headers).has('if-modified-since')).toBe(false);
    const value = overrides[name] ?? fixture(name);
    return typeof value === 'number' ? new Response('', {status:value}) : new Response(value, {headers:{'content-type':'text/markdown'}});
  });
}
async function collect(fetchImpl = mockFetch()) {
  const fetched = await adapter.fetch!(target, state, {timeoutMs:1000,maxResponseBytes:12*1024*1024,retries:0,fetchImpl});
  if (fetched.kind !== 'content') throw Error('Expected content');
  return { fetched, fetchImpl, parsed: adapter.parseRawSnapshot!(snapshot(fetched.text)) };
}
describe('Unity Version Control yearly history', () => {
  test('collects and replays all 156 releases without losing legacy identities or notes', async () => {
    const {fetched,fetchImpl,parsed} = await collect();
    expect(fetchImpl).toHaveBeenCalledTimes(6);
    expect(validateObservations(parsed,adapter.manifest,156)).toHaveLength(156);
    const legacy = adapter.parseRawSnapshot!(snapshot(fixture('legacy')));
    const withoutUrl = (rows: typeof parsed) => rows.map(({sourceUrl,...row})=>row).sort((a,b)=>a.sourceUpdateKey.localeCompare(b.sourceUpdateKey));
    expect(withoutUrl(parsed)).toEqual(withoutUrl(legacy));
    expect(parsed[0].sourceUrl).toContain('/11/2026#11.0.16.10570');
    expect(JSON.parse(fetched.text).years[0].text).toBe(fixture('2026'));
    expect(adapter.parseRawSnapshot!(snapshot(fetched.text))).toEqual(parsed);
  });
  test('still collects the prior single-page layout', async () => {
    const {parsed,fetchImpl}=await collect(mockFetch({index:fixture('legacy')}));
    expect(parsed).toHaveLength(156);expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  test('fails the complete collection if any historical year is unavailable', async () => {
    await expect(collect(mockFetch({'2022':503}))).rejects.toThrow(/503/);
  });
  test('rejects a partial or misdirected year page', async () => {
    await expect(collect(mockFetch({'2026':fixture('2025')}))).rejects.toThrow(/root heading/);
    await expect(collect(mockFetch({'2026':fixture('2026').replace('## 11.0.16.10570','## removed')}))).rejects.toThrow(/count mismatch/);
  });
  test('never fetches an unexpected host from index links', async () => {
    const fetchImpl=mockFetch({index:fixture('index').replace('./11/2026.md','https://example.com/2026.md')});
    await expect(collect(fetchImpl)).rejects.toThrow(/invalid year link/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  test('rejects a missing page on offline replay and any decline from the previous count', async () => {
    const {fetched,parsed}=await collect();const bundle=JSON.parse(fetched.text);bundle.years.pop();
    expect(()=>adapter.parseRawSnapshot!(snapshot(JSON.stringify(bundle)))).toThrow(/missing year/);
    expect(()=>validateObservations(parsed.slice(1),adapter.manifest,156)).toThrow();
  });
});
