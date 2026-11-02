import { expect, test } from "@playwright/test";
test.skip(process.env.ISSUE_REPORT_SEARCH_ENABLED !== "true", "Run with ISSUE_REPORT_SEARCH_ENABLED=true");

test("customer symptom queries return the original note and source context", async ({ request }) => {
  for (const q of ["linux", "fd", "descriptors", "files", "linux file descriptors", "NamedPipeServerStream", 'assertions "file descriptor"']) {
    const response=await request.get('/api/release-notes', {params:{version:'6000.3.23f1',q}});
    expect(response.status()).toBe(200);
    const data=await response.json();
    const note=data.results.find((row:{issue_ids:string[]})=>row.issue_ids.includes('UUM-145761'));
    expect(note.body).toBe('Remove assertions from ToFileDescriptor');
    expect(note.issueReports[0].title).toContain('Linux Editor');
    expect(note).not.toHaveProperty('enriched_search_vector');
    expect(note).not.toHaveProperty('enriched_field_vectors');
  }
});

test("explorer explains a report-only match without mobile overflow", async ({ page }, testInfo) => {
  await page.goto('/explorer?version=6000.3.23f1&q=linux+file+descriptors');
  await expect(page.getByText('Remove assertions from ToFileDescriptor',{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:/UUM-145761: Linux Editor/})).toBeVisible();
  await expect(page.getByText('Linked bug report',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('report-search.png'),fullPage:true});
});

test("release and all compare lane renderers retain report context and markdown", async ({page,request},testInfo) => {
  await page.goto('/releases/6000.3.23f1?q=linux');
  await expect(page.getByRole('link',{name:/UUM-145761: Linux Editor/})).toBeVisible();
  await page.goto('/compare?from=6000.3.21f1&to=6000.3.23f1&lanes=change,known,package');
  for (const label of [/Other changes 1/, /Other known issues 1/, /Package updates 1/]) await page.getByRole('button', { name: label }).click();
  await expect(page.getByRole('link',{name:/UUM-145761: Linux Editor/})).toBeVisible();
  await expect(page.getByRole('link',{name:'UUM-90001: Fixture known-issue report'})).toBeVisible();
  await expect(page.getByRole('link',{name:'UUM-90002: Fixture package report'})).toBeVisible();
  const md=await request.get('/compare.md?from=6000.3.21f1&to=6000.3.23f1');
  expect(md.status()).toBe(200);
  const text=await md.text();
  expect(text).toContain('Linked bug report');
  expect(text).toContain('UUM-145761');
  expect(text).toContain('UUM-90001');
  expect(text).toContain('UUM-90002');
  await page.screenshot({path:testInfo.outputPath('report-compare.png'),fullPage:true});
});
