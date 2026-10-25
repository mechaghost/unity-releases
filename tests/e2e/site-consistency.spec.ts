import { expect, test } from '@playwright/test';

test('clearing every release stream preserves the empty selection', async ({ page }) => {
  await page.goto('/releases?stream=beta');
  await page.locator('label').filter({ has: page.getByRole('checkbox', { name: 'Beta', exact: true }) }).click();
  await expect(page).toHaveURL(/stream=none/);
  await expect(page.getByRole('heading', { name: 'No releases match this filter.' })).toBeVisible();
  await expect(page.locator('.stream-checkbox-filter input:checked')).toHaveCount(0);
  await page.locator('label').filter({ has: page.getByRole('checkbox', { name: '6.0 LTS', exact: true }) }).click();
  await expect(page.locator('.releases-table tbody tr').first()).toBeVisible();
});

test('issue history is reachable without opening a hover card', async ({ page }) => {
  await page.goto('/releases/6000.0.2f1');
  const history = page.locator('.issue-links__history').first();
  await expect(history).toHaveAccessibleName('All mentions of UUM-10001');
  await history.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/issues\/UUM-10001/);
  await expect(page.getByRole('heading', { name: 'UUM-10001', exact: true })).toBeVisible();
});
