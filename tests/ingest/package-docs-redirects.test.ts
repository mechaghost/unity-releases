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
