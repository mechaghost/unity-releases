import { expect, test } from "@playwright/test";

test("home navigation is uniform and refresh time follows the visitor timezone", async ({ browser }, testInfo) => {
  // Use the seeded completed refresh: public metadata is cached across visits.
  const context = await browser.newContext({ ...testInfo.project.use, locale: "en-US", timezoneId: "America/Los_Angeles" });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator(".guide-hero a[href='/compare']")).toHaveCount(0);
    await expect(page.locator(".guide-updated time")).toHaveText("Jul 26, 2026, 5:05 PM PDT");
    await expect(page.locator(".guide-updated time")).toHaveAttribute("datetime", "2026-07-27T00:05:02.000Z");
    const links = page.getByRole("navigation", { name: "Browse release guides" }).getByRole("link");
    await expect(links).toHaveCount(3);
    if (!testInfo.project.name.startsWith("mobile")) {
      const rows = await links.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top));
      expect(new Set(rows).size).toBe(1);
    }
    const fonts = await links.evaluateAll(els => els.map(el => getComputedStyle(el).fontSize));
    expect(new Set(fonts).size).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => document.fonts.ready);
    const fontResources = await page.evaluate(() => performance.getEntriesByType("resource")
      .filter(entry => /\.(?:ttf|woff2?)(?:\?|$)/.test(entry.name))
      .map(entry => ({ url: entry.name, bytes: (entry as PerformanceResourceTiming).decodedBodySize })));
    expect(fontResources.length).toBeGreaterThan(0);
    expect(fontResources.every(font => font.url.endsWith(".woff2"))).toBe(true);
    const fontBytes = fontResources.reduce((sum, font) => sum + font.bytes, 0);
    expect(fontBytes).toBeGreaterThan(0);
    expect(fontBytes).toBeLessThan(450_000);
    await page.screenshot({ path: testInfo.outputPath("home-header.png"), fullPage: true });
  } finally {
    await context.close();
  }
});
