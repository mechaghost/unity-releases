import { expect, type Page } from '@playwright/test';

/** Keep the active guides near the top; browsing older/all features belongs
 * below the cards and must not push them farther down the page. */
export async function expectGuideCardsNearTop(page: Page) {
  const browse = page.getByRole('navigation', { name: 'Browse release guides' });
  await expect(browse.getByRole('link', { name: 'Browse all Unity 6 features' })).toBeVisible();
  const grid = (await page.locator('#release-guides .guide-grid').boundingBox())!;
  const nav = (await browse.boundingBox())!;
  expect(grid.y).toBeLessThanOrEqual(180);
  expect(nav.y).toBeGreaterThanOrEqual(grid.y + grid.height);
}
