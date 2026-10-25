import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import * as cheerio from 'cheerio';
import { parseResourcePage, isNonResourceRedirect } from '../../src/lib/ingest/resources';
import type { FetchedSource } from '../../src/lib/ingest/fetch';
const fixture = (slug: string) => readFileSync(`tests/fixtures/resources/${slug}.report.html`, 'utf8');
const url = (slug: string) => `https://unity.com/resources/${slug}`;
const reports = [
 ['2024-impact-report','2024 Unity Impact Report'],
 ['mobile-growth-monetization-report-2024','2024 Mobile Growth and Monetization Report'],
 ['gaming-report-2024','2024 Unity Gaming Report'],
 ['gaming-report-2025','2025 Unity Gaming Report'],
 ['2023-esg-report','2023 Unity ESG Report'],
 ['gaming-report','2026 Unity Game Development Report']
];
test.each(reports)('verified custom report %s', (slug, title) => {
 const result = parseResourcePage(fixture(slug), url(slug));
 expect(result).toMatchObject({ title, url: url(slug), resourceType: 'Report', resourceDate: null,
   rawMetadata: { parserPath: 'custom-report', canonicalUrl: url(slug) } });
 expect(result!.summary.length).toBeGreaterThan(40);
});
test.each(['gaming-report-2025', 'gaming-report'].flatMap(slug =>
 ['canonical','heading','content','description','og-url','soft-404'].map(reason => [slug, reason])
))('reject %s missing genuine %s', (slug, reason) => {
 const $ = cheerio.load(fixture(slug));
 if(reason==='canonical') $('link[rel=canonical]').attr('href',url('another-report'));
 if(reason==='heading') $('h1').text('Resources');
 if(reason==='content') $('main p').remove();
 if(reason==='description') $('meta[name=description]').remove();
 if(reason==='og-url') $('meta[property="og:url"]').attr('content',url('another-report'));
 if(reason==='soft-404') $('title').text('404: Not found');
 expect(parseResourcePage($.html(),url(slug))).toBeNull();
});
test('rolling report rejects an unrelated report heading', () => {
 const $ = cheerio.load(fixture('gaming-report'));
 $('h1').text('2026 Another Report');
 expect(parseResourcePage($.html(), url('gaming-report'))).toBeNull();
});
test('unrecognized pages do not gain a generic metadata fallback', () => {
 const slug='other-report'; const $=cheerio.load(fixture('gaming-report-2025'));
 $('link[rel=canonical]').attr('href',url(slug)); $('meta[property="og:url"]').attr('content',url(slug));
 expect(parseResourcePage($.html(),url(slug))).toBeNull();
});
const redirect = (): FetchedSource => ({url:url('ai2-thor-session'),finalUrl:'https://unity.com/solutions/robotics',status:200,
 text:fixture('ai2-thor-session'),etag:null,lastModified:null,sha256:''});
test('verified robotics redirect is explicitly nonresource',()=>expect(isNonResourceRedirect(redirect())).toBe(true));
test.each(['canonical','content','error','external','unchanged','status'])('ambiguous redirect preserves existing data: %s', reason=>{
 const source=redirect(); const $=cheerio.load(source.text);
 if(reason==='canonical') $('link[rel=canonical]').remove();
 if(reason==='content') $('main p').remove();
 if(reason==='error') $('h1').text('Not found');
 if(reason==='external') source.finalUrl='https://example.com/solutions/robotics';
 if(reason==='unchanged') source.finalUrl=source.url;
 if(reason==='status') source.status=503;
 source.text=$.html(); expect(isNonResourceRedirect(source)).toBe(false);
});
