import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { RELEASE_GUIDES } from "../../src/lib/release-guides";

test("release overview opens each guide and keeps support types separate", async ({ page }) => {
  await page.goto("/whats-new");
  await expect(page.getByRole("heading", { level: 1, name: "What’s new in Unity?" })).toBeVisible();
  await expect(page.locator(".guide-card")).toHaveCount(7);
  await expect(page.locator(".guide-card").filter({ has: page.getByRole("heading", { name: "Unity 6.1", exact: true }) })).toContainText("Superseded");
  for (const guide of RELEASE_GUIDES) {
    await page.getByRole("link", { name: `Read the Unity ${guide.version} guide` }).click();
    await expect(page.getByRole("heading", { level: 1, name: `What’s new in Unity ${guide.version}?` })).toBeVisible();
    await expect(page.locator(".guide-highlight")).toHaveCount(4);
    await expect(page.locator(".guide-hero .guide-badges")).toContainText(guide.kind === "lts" ? "LTS" : "Update release");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/whats-new/${guide.slug}$`));
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "What’s new" }).click();
  }
});

test("guide details work by keyboard and the layout fits small screens in both themes", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto("/whats-new/unity-6-6");
  await expect(page.locator(".theme-toggle")).toHaveAttribute("aria-label", /Switch to (dark|light) theme/);
  await expect(page.locator(".guide-hero")).toContainText("Sep 1, 2026");
  const summary = page.locator(".guide-highlight summary").first();
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".guide-highlight details").first()).toHaveAttribute("open", "");
  await expect(page.getByText("Existing code may need changes to reset its state correctly between tests.", { exact: true })).toBeVisible();
  for (const theme of ["light", "dark"]) {
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const results = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(results.violations).toEqual([]);
  }
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".guide-print-note").first()).toBeVisible();
  await expect(page.locator(".app-shell__nav")).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await page.goto("/whats-new");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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
