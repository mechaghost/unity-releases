import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const index = "/whats-new/by-feature";
const wcag = ["wcag2a", "wcag2aa", "wcag21aa"];
const areas = [
  ["3D", "3d"],
  ["2D", "2d"],
  ["Multiplayer", "multiplayer"],
  ["Platforms", "platforms"],
  ["UI & Accessibility", "ui-accessibility"],
  ["Editor & Workflow", "editor-workflow"],
  ["Scripting & ECS", "scripting-ecs"],
  ["Performance & Profiling", "performance-profiling"],
  ["Physics", "physics"],
  ["Animation", "animation"],
  ["Audio", "audio"]
];

test("browse engine features from home and jump to a release", async ({ page }, testInfo) => {
  if (testInfo.project.name.startsWith("mobile")) await page.setViewportSize({ width: 320, height: 850 });
  await page.goto("/");
  const browse = page.getByRole("region", { name: "Browse by engine feature" });
  for (const [name, slug] of areas) {
    const link = browse.getByRole("link", { name, exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", `${index}/${slug}`);
    await link.scrollIntoViewIfNeeded();
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
  for (const [name, slug] of areas) {
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
  for (const path of [index, ...areas.map(([, slug]) => `${index}/${slug}`)]) {
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

test("new topics show official reading under the matching releases", async ({ page }, testInfo) => {
  const reading = [
    ["ui-accessibility", "6.3", /Native screen readers on Windows and macOS/, /native-desktop-screen-reader-support/],
    ["editor-workflow", "6.6", /Get started with content directories/, /getting-started-with-content-directories/],
    ["scripting-ecs", "6.6", /Burst moves into the engine/, /the-future-of-burst-in-unity-6-6/],
    ["performance-profiling", "6.2", /Investigate crashes and Android freezes/, /transition-to-new-diagnostics/],
    ["physics", "6.5", /What changed in Physics Core 2D/, /physics-core-2d-in-unity-6-5/],
    ["physics", "6.2", /Try the experimental Unity Vehicles package/, /6000\.2\/Documentation\/Manual\/WhatsNewUnity62\.html#entities$/],
    ["animation", "6.6", /Animation Rigging and Timeline become core packages/, /unity66#animation-rigging-is-a-core-package/],
    ["audio", "6.3", /Extend Unity’s scriptable audio pipeline/, /6000\.3\/manual\/audio\/scriptable-processors/]
  ] as const;
  if (testInfo.project.name.startsWith("mobile")) await page.setViewportSize({ width: 320, height: 850 });
  for (const [slug, version, title, href] of reading) {
    await page.goto(`${index}/${slug}`);
    const versionLinks = page.getByRole("navigation", { name: "Jump to a Unity release" });
    const versions = await versionLinks.getByRole("link").allTextContents();
    expect(versions).toEqual([...versions].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })));
    await versionLinks.getByRole("link", { name: `Unity ${version}`, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#unity-${version.replace(".", "-")}$`));
    const release = page.getByRole("region", { name: new RegExp(`^Unity ${version.replace(".", "\\.")}( LTS)?$`) });
    await expect(release.getByRole("link", { name: title })).toHaveAttribute("href", href);
  }
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished)));
    expect((await new AxeBuilder({ page }).include("main").withTags(wcag).analyze()).violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`audio-${theme}.png`), fullPage: true });
  }
  await page.getByRole("link", { name: "Import more detailed spatial audio", exact: true }).click();
  await expect(page).toHaveURL(/\/whats-new\/unity-6-6\/higher-order-ambisonic-audio$/);
  await expect(page.getByRole("region", { name: "Requirements and limits" })).toContainText("decoder plug-in");
});
