import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("browse all Unity 6 highlights, share filters and open a feature", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Browse all Unity 6 features" }).click();
  await expect(page).toHaveURL(/\/whats-new\/unity-6-features$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Unity 6 feature highlights");
  for (const version of ["6.0", "6.1", "6.2", "6.3", "6.4", "6.5", "6.6"]) {
    expect(await page.locator(".feature-catalog-version").filter({ hasText: `Introduced in Unity ${version}` }).count()).toBeGreaterThan(0);
  }
  const total = await page.locator(".guide-highlight").count();
  await page.getByLabel("Search features").fill("Graph Toolkit");
  await page.getByRole("combobox", { name: "Introduced in", exact: true }).selectOption("6.2");
  await page.getByRole("combobox", { name: "Category", exact: true }).selectOption("Visual tools");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.locator(".guide-highlight")).toHaveCount(1);
  expect(new URL(page.url()).searchParams.get("version")).toBe("6.2");
  await page.reload();
  await expect(page.getByLabel("Search features")).toHaveValue("Graph Toolkit");
  await page.getByRole("link", { name: "Create custom visual editors", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Create custom visual editors");
  await page.goBack();
  await page.getByLabel("Search features").fill("no-such-feature-xyz");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByRole("heading", { name: "No matching features" })).toBeVisible();
  await page.getByRole("link", { name: "Clear filters", exact: true }).click();
  await expect(page.locator(".guide-highlight")).toHaveCount(total);

  // Keep screenshot/accessibility checks small while exercising the same card layout.
  await page.getByRole("combobox", { name: "Introduced in", exact: true }).selectOption("6.2");
  await page.getByRole("button", { name: "Apply filters" }).click();
  if (testInfo.project.name.startsWith("mobile")) await page.setViewportSize({ width: 320, height: 850 });
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
    await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished)));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`unity6-${theme}.png`), fullPage: true });
    expect((await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  }
});
