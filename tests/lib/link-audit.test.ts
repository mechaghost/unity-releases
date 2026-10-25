import { describe, expect, it } from 'vitest';
import { auditSite, classifyLink, type AuditResponse } from '../../src/lib/link-audit';
const origin = 'https://site.test';
const html = (body: string, status = 200, finalUrl = origin): AuditResponse => ({ body, status, finalUrl, contentType: 'text/html' });
describe('link audit', () => {
  it('detects soft 404s even when HTTP succeeds, but does not call a block broken', () => {
    expect(classifyLink(html('', 200, 'https://issuetracker.unity.com/not-found'))).toBe('broken');
    expect(classifyLink(html('<title>Page not found • Unity Docs</title>'))).toBe('broken');
    expect(classifyLink(html('', 429))).toBe('blocked');
    expect(classifyLink(html('', 403))).toBe('blocked');
    expect(classifyLink(html('', 500))).toBe('broken');
  });
  it('crawls query links, detects missing anchors and never recurses into external sites', async () => {
    const calls: string[] = [];
    const responses: Record<string, AuditResponse> = {
      [origin + '/']: html('<a href="/items?page=2#missing">Next</a><a href="https://unity.com/doc">Docs</a>'),
      [origin + '/items?page=2']: html('<main id="main">Page 2</main>', 200, origin + '/items?page=2'),
      'https://unity.com/doc': html('<a href="https://unity.com/more">More</a>', 200, 'https://unity.com/doc')
    };
    const result = await auditSite({ origin, seeds: ['/'], externalLimit: 10, delayMs: 0, fetchPage: async url => { calls.push(url); return responses[url]; } });
    expect(calls).toEqual([origin + '/', origin + '/items?page=2', 'https://unity.com/doc']);
    expect(result.results.some(r => r.url.endsWith('#missing') && r.reason === 'Missing fragment target')).toBe(true);
    expect(result.broken).toBe(1);
  });
  it('stops checking a host after its first block and reports unknown links honestly', async () => {
    const calls: string[] = [];
    const result = await auditSite({ origin, seeds: ['/'], externalLimit: 10, delayMs: 0, fetchPage: async url => {
      calls.push(url);
      return url === origin + '/' ? html('<a href="https://unity.com/a">a</a><a href="https://unity.com/b">b</a>') : html('', 429, url);
    } });
    expect(calls).toHaveLength(2);
    expect(result.broken).toBe(0);
    expect(result.unverified).toBe(2);
    expect(result.complete).toBe(false);
  });
  it('bounds pages and samples external URLs without claiming the remainder passed', async () => {
    const result = await auditSite({ origin, seeds: ['/'], maxPages: 1, externalLimit: 0, delayMs: 0,
      fetchPage: async () => html('<a href="/a">a</a><a href="https://unity.com/a">a</a>') });
    expect(result.results.filter(r => r.result === 'unverified')).toHaveLength(2);
    expect(result.complete).toBe(false);
  });
  it('does not fetch credentials, unsafe schemes, or unapproved external hosts', async () => {
    const calls: string[] = [];
    const result = await auditSite({ origin, seeds: ['/'], externalLimit: 10, delayMs: 0, fetchPage: async url => {
      calls.push(url); return html('<a href="http://127.0.0.1/admin">local</a><a href="https://user:pass@unity.com/">auth</a><a href="javascript:alert(1)">js</a>');
    } });
    expect(calls).toEqual([origin + '/']);
    expect(result.unverified).toBe(1);
  });
  it('keeps network errors visible and identifies unhealthy health payloads', async () => {
    const result = await auditSite({ origin, seeds: ['/api/health', '/failed'], delayMs: 0, fetchPage: async url => {
      if (url.endsWith('/failed')) throw new Error('timeout');
      return { body: '{"status":"stale"}', status: 200, finalUrl: url, contentType: 'application/json' };
    } });
    expect(result.broken).toBe(2);
    expect(result.unverified).toBe(0);
  });
});

describe('audit failure boundaries', () => {
  it('fails incomplete internal checks independently of sampled external links', async () => {
    const { auditExitCode } = await import('../../src/lib/link-audit');
    expect(auditExitCode({ broken: 0, internalComplete: false, complete: false })).toBe(2);
    expect(auditExitCode({ broken: 0, internalComplete: true, complete: false })).toBe(0);
    expect(auditExitCode({ broken: 0, internalComplete: true, complete: false }, true)).toBe(2);
  });
  for (const body of ['{}', '{invalid', '{"packages":[{}]}']) it(`retains evidence for malformed package index: ${body}`, async () => {
    const report = await auditSite({ origin, seeds: ['/api/packages'], delayMs: 0, fetchPage: async url => ({ body, status: 200, contentType: 'application/json', finalUrl: url }) });
    expect(report.broken).toBe(1);
    expect(report.results[0].url).toBe(origin + '/api/packages');
  });
  it('checks later package history pages and uses rendered link policy', async () => {
    const report = await auditSite({ origin, seeds: ['/api/packages/com.unity.test/versions'], delayMs: 0, fetchPage: async url => ({
      status: 200, finalUrl: url, contentType: 'application/json', body: JSON.stringify({ page: url.includes('?page=2') ? 2 : 1, pages: 2,
        versions: [{ changelog: '[Gone](https://unity.com/blog/unity-plugin-for-codex)' }] })
    }) });
    expect(report.results).toHaveLength(2);
    expect(report.broken).toBe(0);
  });
  it('rejects unexpected history shape instead of silently checking no links', async () => {
    const report = await auditSite({ origin, seeds: ['/api/packages/com.unity.test/versions'], delayMs: 0, fetchPage: async url => ({
      status: 200, finalUrl: url, contentType: 'application/json', body: '{"error":"upstream failed"}'
    }) });
    expect(report.broken).toBe(1);
  });
  for (const destination of ['http://127.0.0.1/admin', 'https://unapproved.example/path', 'https://user:pass@unity.com/private']) {
    it(`rejects redirected requests to ${destination}`, async () => {
      const { fetchAuditPage } = await import('../../src/lib/link-audit');
      let calls = 0;
      const fakeFetch = async () => { calls++; return new Response('', { status: 302, headers: { location: destination } }); };
      await expect(fetchAuditPage('https://unity.com/doc', fakeFetch as typeof fetch)).rejects.toThrow(/redirect/i);
      expect(calls).toBe(1);
    });
  }
});

for (const path of ['/api/packages', '/api/packages/com.unity.test/versions']) it(`rejects HTML masquerading as API ${path}`, async () => {
  const report = await auditSite({ origin, seeds: [path], delayMs: 0, fetchPage: async url => html('<main>Temporarily unavailable</main>', 200, url) });
  expect(report.broken).toBe(1);
});
for (const status of [403, 429]) it(`does not pass blocked internal pages (${status})`, async () => {
  const { auditExitCode } = await import('../../src/lib/link-audit');
  const report = await auditSite({ origin, seeds: ['/'], delayMs: 0, fetchPage: async url => html('', status, url) });
  expect(report.internalComplete).toBe(false);
  expect(auditExitCode(report)).toBe(2);
});
