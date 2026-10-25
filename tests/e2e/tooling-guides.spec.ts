import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const path of ["/", "/whats-new"]) {
  test(`${path} places Pipeline and CLI immediately after release guides`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('#release-guides + #pipeline-and-cli')).toBeVisible();
    for (const [name, slug] of [["Unity Pipeline", "unity-pipeline"], ["Unity CLI", "unity-cli"]]) {
      const link = page.locator('#pipeline-and-cli a').filter({ has: page.getByRole('heading', { name, exact: true }) });
      await link.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(new RegExp(`/whats-new/${slug}$`));
      await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
      await expect(page.locator('#recent-changes')).toContainText('Latest reviewed');
      await expect(page.locator('#features section').first()).toBeVisible();
      await page.goto(path);
    }
  });
}

for (const path of ['/', '/whats-new/unity-pipeline', '/whats-new/unity-cli']) {
  test(`${path} tooling is accessible on narrow screens and both themes`, async ({ page }, testInfo) => {
    if (testInfo.project.name.startsWith('mobile')) await page.setViewportSize({ width: 320, height: 850 });
    await page.goto(path);
    const selector = path === '/' ? '#pipeline-and-cli' : 'article.release-guide';
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
      await page.locator(selector).scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).include(selector).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
      await page.locator(selector).screenshot({ path: testInfo.outputPath(`tooling-${theme}.png`) });
    }
  });
}
