import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parseDocsLatestRedirectMinor, isPackageManagerManualRedirect } from '../../src/lib/parsers/package-docs';
const hdrp=readFileSync('tests/fixtures/package-docs/hdrp-latest-redirect.html','utf8');
const manual=readFileSync('tests/fixtures/package-docs/package-manager-manual.html','utf8');
const pkg='com.unity.render-pipelines.high-definition';
const finalUrl=`https://docs.unity3d.com/Packages/${pkg}@latest/`;
test('captured HDRP redirect identifies the actual different minor without executing JS',()=>{
 expect(parseDocsLatestRedirectMinor(hdrp,finalUrl,pkg)).toBe('17.7');
});
test.each(['title','package','origin','path','link'])('unverified latest redirect stays uncertain: %s',reason=>{
 expect(parseDocsLatestRedirectMinor(reason==='title'?hdrp.replace('Redirecting to latest version','Unavailable'):reason==='link'?hdrp.replace("href='../com.unity.render-pipelines.high-definition@17.7/index.html'","href='https://example.com/'"):hdrp,
 reason==='origin'?finalUrl.replace('docs.unity3d.com','example.com'):reason==='path'?finalUrl.replace('@latest/','@6.6/'):finalUrl,
 reason==='package'?'com.unity.entities':pkg)).toBeNull();
});
test('captured Package Manager redirect requires the exact manual, title and content',()=>{
 expect(isPackageManagerManualRedirect(manual,'https://docs.unity3d.com/Manual/upm-ui.html','com.unity.package-manager-ui')).toBe(true);
 expect(isPackageManagerManualRedirect(manual,'https://docs.unity3d.com/Manual/upm-ui.html',pkg)).toBe(false);
 expect(isPackageManagerManualRedirect(manual.replaceAll('Package Manager window reference','Not found'),'https://docs.unity3d.com/Manual/upm-ui.html','com.unity.package-manager-ui')).toBe(false);
 expect(isPackageManagerManualRedirect(manual,'https://example.com/Manual/upm-ui.html','com.unity.package-manager-ui')).toBe(false);
});

const migrated=readFileSync('tests/fixtures/package-docs/package-manager-manual-migrated.html','utf8');
const migratedUrl='https://docs.unity.com/en-us/engine/6000.6/manual/packages-list/upm-ui-window/upm-ui';
test('captured migrated manual identifies the reference without inventing a changelog',()=>{
 expect(isPackageManagerManualRedirect(migrated,migratedUrl,'com.unity.package-manager-ui')).toBe(true);
});
test.each([
 ['package', migrated, migratedUrl, 'com.unity.entities'],
 ['origin', migrated, migratedUrl.replace('docs.unity.com','example.com')],
 ['path', migrated, migratedUrl.replace(/upm-ui$/, 'upm-ui-access')],
 ['query', migrated, `${migratedUrl}?page=other`],
 ['version mismatch', migrated, migratedUrl.replace('6000.6','6000.5')],
 ['title', migrated.replace('<title>Package Manager window reference', '<title>Unavailable'), migratedUrl],
 ['heading', migrated.replace(/(<h1[^>]*>)[\s\S]*?(<\/h1>)/, '$1Not found$2'), migratedUrl],
 ['alternate', migrated.replace(`href="${migratedUrl}.md"`, 'href="https://example.com/manual.md"'), migratedUrl],
 ['article shell', '<title>Package Manager window reference</title>', migratedUrl],
 ['missing section', migrated.replace('id="status-bar"', 'id="other"'), migratedUrl],
])('unverified migrated manual stays uncertain: %s',(_reason,html,url,packageName?: string)=>{
 expect(isPackageManagerManualRedirect(html,url,packageName ?? 'com.unity.package-manager-ui')).toBe(false);
});
