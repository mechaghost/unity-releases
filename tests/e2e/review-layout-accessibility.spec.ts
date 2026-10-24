import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("search keeps results near the top and retains collapsed filter values", async ({ page }) => {
  await page.goto("/explorer?minorLine=6000.0");
  const filters = page.locator(".explorer-filter__details");
  await expect(filters).not.toHaveAttribute("open");
  expect((await page.locator(".list-toolbar").boundingBox())!.y).toBeLessThan(500);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  expect(new URL(page.url()).searchParams.get("minorLine")).toBe("6000.0");
  await filters.locator("summary").click();
  await page.getByRole("combobox", { name: "Unity minor line" }).selectOption("");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  expect(new URL(page.url()).searchParams.get("minorLine")).toBe("");
});

test("chart links have accessible names and are not hidden inside image roles", async ({ page }) => {
  for (const route of ["/visualizer", "/issues"]) {
    await page.goto(route);
    await expect(page.locator('svg[role="img"] a')).toHaveCount(0);
    for (const link of await page.locator("svg a[href]").all()) {
      await expect(link).toHaveAccessibleName(/\S/);
    }
    const result = await new AxeBuilder({ page }).include("main")
      .withRules(["link-name", "aria-allowed-attr", "aria-allowed-role"]).analyze();
    expect(result.violations).toEqual([]);
  }
});

test("package sorting exposes its state on the column header", async ({ page }) => {
  await page.goto("/packages?sort=name_asc");
  await expect(page.locator('th[aria-sort="ascending"]')).toHaveText(/Package/);
  await expect(page.locator("a[aria-sort]")).toHaveCount(0);
});

test("stats stays within a narrow viewport and FAQ links are underlined", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto("/stats");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("region", { name: "Ingestion freshness" })).toHaveAttribute("tabindex", "0");
  await page.goto("/faq");
  const link = page.locator(".faq-item__answer a").first();
  expect(await link.evaluate(el => getComputedStyle(el).textDecorationLine)).toContain("underline");
});
