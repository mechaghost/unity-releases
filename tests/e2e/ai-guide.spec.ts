import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("AI guide is discoverable and its steps work on desktop and mobile", async ({ page, request }, testInfo) => {
  await page.goto("/resources");
  await page.getByRole("link", { name: "Start with the AI with Unity guide", exact: true }).click();
  await expect(page).toHaveURL(/\/guides\/ai-with-unity$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("How to use AI with Unity");
  await expect(page.locator('.lnav a[aria-current="page"]')).toHaveCount(1);
  await expect(page.locator('.lnav a[aria-current="page"]')).toHaveText("AI with Unity");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/guides\/ai-with-unity$/);
  await expect(page.locator("main")).not.toContainText(/Muse|MCP/);
  await page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: /Run a model with Sentis/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#sentis$/);
  await page.getByText("Which Sentis package?", { exact: true }).click();
  await expect(page.locator("#sentis")).toContainText("com.unity.ai.inference");
  const images = page.locator("main img");
  await expect(images).toHaveCount(2);
  for (const img of await images.all()) {
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
  const wordCount = (await page.locator("main").innerText()).trim().split(/\s+/).length;
  expect(wordCount).toBeLessThan(650);
  await expect(page.locator("#sentis")).toContainText("Unity.InferenceEngine");

  const internalLinks = await page.locator('main a[href^="/"]').evaluateAll(els => [...new Set(els.map(el => el.getAttribute("href")!))]);
  for (const href of internalLinks) expect((await request.get(href)).status(), href).toBe(200);
  const anchors = await page.locator('main a[href^="#"]').evaluateAll(els => els.map(el => el.getAttribute("href")!));
  for (const href of anchors) await expect(page.locator(href)).toHaveCount(1);

  if (testInfo.project.name.startsWith("mobile")) await page.setViewportSize({ width: 320, height: 850 });
  for (const theme of ["light", "dark"]) {
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished)));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`ai-guide-${theme}.png`), fullPage: true });
  }
  await page.goto("/faq");
  await page.getByRole("link", { name: "AI with Unity guide", exact: true }).click();
  await expect(page).toHaveURL(/\/guides\/ai-with-unity$/);
});
