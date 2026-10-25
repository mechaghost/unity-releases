import { expect, type Page } from '@playwright/test';

/** Preserve the original guide-density budget while accounting for the catalog
 * action added in 6aa230d. Bound that action and the following gap independently
 * so a growing header cannot hide behind a larger absolute page-height limit.
 */
export async function expectGuideCardsNearTop(page: Page) {
  const catalog = page.locator('.feature-catalog-entry');
  await expect(catalog.getByRole('link', { name: 'Browse all Unity 6 features' })).toBeVisible();
  const action = (await catalog.boundingBox())!;
  const card = (await page.locator('.guide-card').first().boundingBox())!;
  expect(action.height).toBeLessThanOrEqual(44);
  expect(card.y).toBeGreaterThanOrEqual(action.y + action.height);
  expect(card.y - action.y - action.height).toBeLessThanOrEqual(24);
  expect(card.y - action.height).toBeLessThan(180);
}
