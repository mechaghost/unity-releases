import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const index = "/whats-new/by-feature";
const wcag = ["wcag2a", "wcag2aa", "wcag21aa"];

test("browse engine features from home and jump to a release", async ({ page }, testInfo) => {
  await page.goto("/");
  const browse = page.getByRole("region", { name: "Browse by engine feature" });
  for (const name of ["3D", "2D", "Multiplayer", "Platforms"]) {
    const link = browse.getByRole("link", { name, exact: true });
    await expect(link).toBeVisible();
    await link.locator("img").evaluate((image: HTMLImageElement) => image.decode());
  }
  await browse.scrollIntoViewIfNeeded();
  await browse.screenshot({ path: testInfo.outputPath("engine-feature-cards.png") });
  await browse.getByRole("link", { name: "2D", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${index}/2d$`));
  await expect(page.getByRole("heading", { name: "2D in Unity 6", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toContainText(["Unity 6.6", "Unity 6.5", "Unity 6.4", "Unity 6.3 LTS"]);
  await page.getByRole("navigation", { name: "Jump to a Unity release" }).getByRole("link", { name: "Unity 6.3" }).click();
  await expect(page).toHaveURL(/#unity-6-3$/);
  const olderRelease = page.getByRole("region", { name: "Unity 6.3 LTS" });
  await expect(olderRelease.getByRole("link", { name: /Get started with the Sprite Atlas Analyzer/ })).toHaveAttribute("href", /discussions\.unity\.com\/t\/sprite-atlas-analyzer/);
  await olderRelease.getByRole("link", { name: "Find unused texture space", exact: true }).click();
  await expect(page).toHaveURL(/\/whats-new\/unity-6-3\/sprite-atlas-analyzer$/);
});

test("area guides have shareable URLs, source links, and readable layouts", async ({ page, request }, testInfo) => {
  if (testInfo.project.name.startsWith("mobile")) await page.setViewportSize({ width: 320, height: 850 });
  await page.goto(index);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What’s new by engine feature");
  for (const [name, slug] of [["3D", "3d"], ["2D", "2d"], ["Multiplayer", "multiplayer"], ["Platforms", "platforms"]]) {
    await page.getByRole("main").getByRole("link", { name, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${name} in Unity 6`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${index}/${slug}$`));
    const sourceLinks = page.getByRole("main").locator('article a[href^="https://"]');
    expect(await sourceLinks.count()).toBeGreaterThan(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator(".guide-breadcrumb").getByRole("link", { name: "Engine features" }).click();
  }
  expect((await request.get(`${index}/unknown`)).status()).toBe(404);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const path of [index, ...["3d", "2d", "multiplayer", "platforms"].map(slug => `${index}/${slug}`)]) {
    expect(sitemap).toContain(`${path}</loc>`);
  }

  await page.goto(`${index}/multiplayer`);
  const toggle = page.getByRole("button", { name: "Open navigation" });
  if (await toggle.isVisible()) await toggle.click();
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "Engine features" })).toHaveAttribute("aria-current", "page");
  if (testInfo.project.name.startsWith("mobile")) await page.keyboard.press("Escape");

  const templates = page.getByRole("link", { name: /Start with a multiplayer template/ });
  await expect(templates).toHaveAttribute("href", /discussions\.unity\.com\/t\/unity-6-3-new-multiplayer-templates/);
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished)));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).include("main").withTags(wcag).analyze()).violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`engine-guide-${theme}.png`), fullPage: true });
  }
});
