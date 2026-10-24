import { test, expect } from "@playwright/test";
import { featureHref, guideFeatures } from "../../src/lib/release-features";
import { load } from "cheerio";
import AxeBuilder from "@axe-core/playwright";
import { RELEASE_GUIDES } from "../../src/lib/release-guides";

test("release overview opens each guide and keeps support types separate", async ({ page }, testInfo) => {
  await page.goto("/whats-new");
  await expect(page.getByRole("heading", { level: 1, name: "What’s new in Unity?" })).toBeVisible();
  await expect(page.locator(".guide-card")).toHaveCount(3);
  await expect(page.getByRole("link", { name: "Read the Unity 6.6 guide", exact: true })).toHaveAttribute("href", "/whats-new/unity-6-6");
  expect((await page.locator(".guide-card").first().boundingBox())!.y).toBeLessThanOrEqual(180);
  await expect(page.locator("#release-guides")).not.toContainText("Superseded");
  for (const version of ["6.1", "6.2", "6.4", "6.5"]) {
    await expect(page.getByRole("link", { name: `Read the Unity ${version} guide`, exact: true })).toHaveCount(0);
  }
  for (const guide of RELEASE_GUIDES) {
    const card = page.getByRole("link", { name: `Read the Unity ${guide.version} guide`, exact: true });
    if (await card.count()) await card.click();
    else await page.goto(`/whats-new/${guide.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: `What’s new in Unity ${guide.version}?` })).toBeVisible();
    await expect(page.locator(".guide-highlight")).toHaveCount(guide.highlights.length);
    expect((await page.locator(".guide-highlight").first().boundingBox())!.y).toBeLessThanOrEqual(260);
    await expect(page.locator(".guide-highlight details")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Image source", exact: true })).toHaveCount(0);
    for (const item of guideFeatures(guide)) {
      const card = page.locator(".guide-highlight").filter({ has: page.getByRole("heading", { name: item.title, exact: true }) });
      await expect(card).toContainText(item.benefit);
      await expect(card.getByRole("link")).toHaveCount(1);
      await expect(card.getByRole("link")).toHaveAttribute("href", featureHref(guide, item));
    }
    const images = page.locator(".guide-highlight img");
    await expect(images).toHaveCount(guide.highlights.length);
    for (const frame of await page.locator(".guide-feature-image").all()) {
      const bounds = (await frame.boundingBox())!;
      expect(Math.abs(bounds.width / bounds.height - 16 / 9)).toBeLessThan(0.02);
    }
    for (const img of await images.all()) {
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`${guide.slug}.png`), fullPage: true });
    await expect(page.locator(".guide-hero .guide-badges")).toContainText(guide.kind === "lts" ? "LTS" : "Update release");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/whats-new/${guide.slug}$`));
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "What’s new" }).click();
  }
  for (const img of await page.locator(".guide-card img").all()) {
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("overview.png"), fullPage: true });
});

test("guide details work by keyboard and the layout fits small screens in both themes", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto("/whats-new/unity-6-6");
  expect((await page.locator(".guide-highlight").first().boundingBox())!.y).toBeLessThanOrEqual(260);
  await expect(page.locator(".theme-toggle")).toHaveAttribute("aria-label", /Switch to (dark|light) theme/);
  await expect(page.locator(".guide-support")).toContainText("Sep 1, 2026");
  await expect(page.locator(".guide-highlight details")).toHaveCount(0);
  await expect(page.locator(".guide-feature-link").first()).toBeVisible();
  const summary = page.locator(".guide-support summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".guide-support")).toHaveAttribute("open", "");
  for (const theme of ["light", "dark"]) {
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    // Audit the settled theme, after the shared button color transitions.
    await page.evaluate(() => Promise.all(Array.from(document.querySelectorAll(".btn")).flatMap(element => element.getAnimations()).map(animation => animation.finished)));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const results = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(results.violations).toEqual([]);
  }
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".guide-feature-link").first()).toBeVisible();
  await expect(page.locator(".app-shell__nav")).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await page.goto("/whats-new");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await page.locator(".guide-card").first().boundingBox())!.y).toBeLessThanOrEqual(180);
  const overviewAudit = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(overviewAudit.violations).toEqual([]);
});

test("guides have one selected primary nav item and unknown guides return 404", async ({ page }, testInfo) => {
  await page.goto("/whats-new/unity-6-3");
  if (testInfo.project.name.startsWith("mobile")) await page.getByRole("button", { name: "Open navigation" }).click();
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "What’s new" })).toHaveAttribute("aria-current", "page");
  const response = await page.goto("/whats-new/unity-99-0");
  expect(response?.status()).toBe(404);
});

test("every feature has a complete, shareable detail page", async ({ request }) => {
  for (const guide of RELEASE_GUIDES) {
    for (const feature of guideFeatures(guide)) {
      const path = featureHref(guide, feature);
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      const $ = load(await response.text());
      expect($("h1").text()).toBe(feature.title);
      expect($("link[rel=canonical]").attr("href")).toMatch(new RegExp(`${path}$`));
      expect($("#what-changed").length).toBe(1);
      expect($("#use-it").length).toBe(1);
      expect($(".feature-link-list a").length).toBeGreaterThan(0);
      expect($(".feature-tool-list a").length).toBeGreaterThan(1);
      expect($(".feature-detail-main").text()).toContain(feature.details.steps[0]);
      const requirements = feature.details.notes.length ? feature.details.notes : feature.limitation ? [feature.limitation] : [];
      for (const requirement of requirements) expect($(".feature-requirements").text()).toContain(requirement);
      expect($(".guide-breadcrumb a").last().attr("href")).toBe(`/whats-new/${guide.slug}`);
    }
  }
  expect((await request.get("/whats-new/unity-6-6/not-a-feature")).status()).toBe(404);
  expect((await request.get("/whats-new/not-a-release/not-a-feature")).status()).toBe(404);
});

test("feature cards open by image or keyboard and details connect to technical tools", async ({ page }, testInfo) => {
  const guide = RELEASE_GUIDES[0];
  const feature = guideFeatures(guide)[0];
  const path = featureHref(guide, feature);
  await page.goto(`/whats-new/${guide.slug}`);
  const card = page.locator(".guide-feature-link").first();
  await card.locator("img").click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.getByRole("heading", { name: feature.title, level: 1 })).toBeVisible();
  await expect(page.locator(".feature-primary-link")).toHaveAttribute("href", feature.details.links[0].url);
  await page.goBack();
  await card.locator("p").click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await page.goBack();
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.getByRole("link", { name: "Image source", exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("feature-details.png"), fullPage: true });
  const notes = page.getByRole("link", { name: `Search Unity ${guide.version} release notes`, exact: true });
  await notes.click();
  await expect(page).toHaveURL(/\/explorer\?/);
  await expect(page.locator('input[name="q"]')).toHaveValue(feature.details.searchTerms[0]);
  await expect(page.locator('select[name="minorLine"]')).toHaveValue("6000.6");
  await page.goto(path);
  await page.setViewportSize({ width: 320, height: 850 });
  for (const theme of ["light", "dark"]) {
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    // Audit the settled theme, after the shared button color transitions.
    await page.evaluate(() => Promise.all(Array.from(document.querySelectorAll(".btn")).flatMap(element => element.getAnimations()).map(animation => animation.finished)));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const results = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(results.violations).toEqual([]);
  }
  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: `Unity ${guide.version}`, exact: true }).click();
  await expect(page.locator(".guide-highlight")).toHaveCount(guide.highlights.length);
});
