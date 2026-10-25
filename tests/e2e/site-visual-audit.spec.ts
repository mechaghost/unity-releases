import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const routes = [
  '/', '/releases', '/releases/6000.0.2f1', '/compare',
  '/compare?from=6000.0.1f1&to=6000.0.2f1', '/packages', '/explorer',
  '/issues', '/issues/UUM-10001', '/visualizer', '/news', '/resources',
  '/discussions', '/github', '/timeline', '/stats', '/faq',
  '/whats-new/past-releases', '/whats-new/unity-6-features',
  '/whats-new/unity-6-6', '/updates', '/updates/editor-tooling',
  '/updates/products/unity-hub', '/updates/products/unity-hub/3.14.0'
];

for (const route of routes) {
  test(`${route} keeps its layout and accessible presentation in both themes`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    // Include the narrowest supported phone width; the other project is desktop.
    if (testInfo.project.name.startsWith('mobile')) await page.setViewportSize({ width: 320, height: 850 });
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.locator('.theme-toggle')).toHaveAttribute('aria-label', /Switch to/);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
      // Wait for theme color transitions before measuring contrast.
      await page.waitForTimeout(300);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const result = await new AxeBuilder({ page }).analyze();
      expect(result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([]);
    }
    expect(errors).toEqual([]);
  });
}

test('mobile filter pills wrap consistently across list pages', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['/releases', '/packages', '/resources', '/timeline']) {
    await page.goto(route);
    const pills = page.locator('.stream-checkbox-filter__option');
    const first = await pills.nth(0).boundingBox();
    const second = await pills.nth(1).boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(Math.abs(first!.y - second!.y)).toBeLessThan(2);
  }
});
