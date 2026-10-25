import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("filter controls have labels when their sections are expanded", async ({ page }) => {
  await page.goto("/compare?from=6000.0.1f1&to=6000.0.2f1");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Filter results" });
  for (const section of await dialog.locator('.filter-section__head').all()) {
    if (await section.getAttribute('aria-expanded') === 'false') await section.click();
  }
  await expect(dialog.getByRole("searchbox", { name: "Search release notes" })).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Issue ID", exact: true })).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Preset name" })).toBeVisible();
  const results = await new AxeBuilder({ page }).include('.filter-surface__panel')
    .withRules(["label", "select-name"]).analyze();
  expect(results.violations).toEqual([]);
});

test("a completed filter request does not replace a newer search edit", async ({ page }) => {
  await page.goto("/releases/6000.0.2f1");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Filter results" });
  await dialog.getByRole("button", { name: "Search", exact: true }).click();
  const search = dialog.getByRole("searchbox", { name: "Search release notes" });
  let releaseResponse!: () => void;
  const holdResponse = new Promise<void>(resolve => { releaseResponse = resolve; });
  let responseReady!: () => void;
  const ready = new Promise<void>(resolve => { responseReady = resolve; });
  await page.route('**/releases/6000.0.2f1?**', async route => {
    if (new URL(route.request().url()).searchParams.get('q') !== 'render') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    responseReady();
    await holdResponse;
    await route.fulfill({ response });
  });
  await search.fill('render');
  await ready;
  // Keep the newer draft unapplied until the older response has arrived.
  await page.evaluate(() => {
    const schedule = window.setTimeout.bind(window);
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) =>
      schedule(handler, delay === 300 ? 60_000 : delay, ...args)) as typeof window.setTimeout;
  });
  await search.fill('render pipeline');
  releaseResponse();
  await expect(page).toHaveURL(/q=render(?:&|$)/);
  await expect(search).toHaveValue('render pipeline');
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page).toHaveURL(/q=render\+pipeline/);
});

test("theme toggle works when browser storage is unavailable", async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Storage blocked', 'SecurityError'); }
    });
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  if (await page.getByRole('button', { name: 'Open navigation' }).isVisible()) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
  }
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(errors).toEqual([]);
});
