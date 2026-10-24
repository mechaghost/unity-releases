import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("home foregrounds release guides and comparison remains a separate tool", async ({ page, baseURL }, testInfo) => {
  await page.goto("/?utm_source=review");
  await expect(page.getByRole("heading", { level: 1, name: "What’s new in Unity?" })).toBeVisible();
  await expect(page.locator(".guide-card")).toHaveCount(3);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https?:\/\/[^/]+\/?$/);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", /^https?:\/\/[^/]+\/?$/);
  expect((await page.locator(".guide-card").first().boundingBox())!.y).toBeLessThan(180);
  const card = page.locator(".guide-card").first();
  await expect(card.locator("a")).toHaveCount(1);
  await card.locator("img").evaluate((img: HTMLImageElement) => img.decode());
  await page.screenshot({ path: testInfo.outputPath("home.png"), fullPage: true });
  const nav = page.getByRole("navigation", { name: "Primary" });
  if (testInfo.project.name.startsWith("mobile")) await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "What’s new", exact: true })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "Compare versions", exact: true }).click();
  await expect(page).toHaveURL(/\/compare$/);
  await expect(page.getByRole("heading", { name: "Compare versions", level: 1 })).toBeVisible();
  if (testInfo.project.name.startsWith("mobile")) await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "Compare versions", exact: true })).toHaveAttribute("aria-current", "page");
  await nav.locator(".lnav__brand").click();
  await expect(page).toHaveURL(`${baseURL}/`);
  await page.goto("/whats-new");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https?:\/\/[^/]+\/?$/);
  await page.setViewportSize({ width: 320, height: 850 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const theme of ["light", "dark"]) {
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    // Audit the settled theme, after the shared button color transitions.
    await page.evaluate(() => Promise.all(Array.from(document.querySelectorAll(".btn")).flatMap(element => element.getAnimations()).map(animation => animation.finished)));
    expect((await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  }
});

test("old root comparison bookmarks keep their filters", async ({ request, baseURL }) => {
  const response = await request.get("/?from=6000.0.1f1&to=6000.0.2f1&stream=LTS&stream=SUPPORTED&p_fixes=2", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  const target = new URL(response.headers().location, baseURL);
  expect(target.pathname).toBe("/compare");
  expect(target.searchParams.getAll("stream")).toEqual(["LTS", "SUPPORTED"]);
  expect(target.searchParams.get("from")).toBe("6000.0.1f1");
  expect(target.searchParams.get("p_fixes")).toBe("2");
});
