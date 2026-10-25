import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("past releases are reachable below current cards and open their guides", async ({ page }, testInfo) => {
  for (const path of ["/", "/whats-new"]) {
    await page.goto(path);
    const link = page.getByRole("link", { name: "Past releases", exact: true });
    await expect(link).toHaveAttribute("href", "/whats-new/past-releases");
    const cardsBottom = await page.locator("#release-guides .guide-grid").evaluate(el => el.getBoundingClientRect().bottom);
    expect((await link.boundingBox())!.y).toBeGreaterThanOrEqual(cardsBottom);
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/whats-new\/past-releases$/);
    await expect(page.getByRole("heading", { level: 1, name: "Past releases" })).toBeVisible();
    await expect(page.locator(".guide-card h2")).toHaveText(["Unity 6.5", "Unity 6.4", "Unity 6.2", "Unity 6.1"]);
    for (const version of ["6.5", "6.4", "6.2", "6.1"]) {
      await page.getByRole("link", { name: `Read the Unity ${version} guide`, exact: true }).click();
      await expect(page.getByRole("heading", { level: 1, name: `What’s new in Unity ${version}?` })).toBeVisible();
      await page.goBack();
    }
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "What’s new" }).click();
    await expect(page.locator("#release-guides .guide-card")).toHaveCount(3);
  }
  if (testInfo.project.name.startsWith("mobile")) await page.setViewportSize({ width: 320, height: 850 });
  await page.goto("/whats-new/past-releases");
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
    await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished)));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`past-releases-${theme}.png`), fullPage: true });
    expect((await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  }
});
