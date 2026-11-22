import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const path = "/whats-new/unite-tokyo-2026";

test("Unite Tokyo guide is discoverable and labels tool availability", async ({ page, request }, testInfo) => {
  if (testInfo.project.name.startsWith("mobile")) await page.setViewportSize({ width: 320, height: 850 });
  await page.goto("/");
  const guide = page.getByRole("link", { name: "Unite Tokyo 2026", exact: true });
  await guide.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Unite Tokyo 2026");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${path}$`));
  await expect(page.getByRole("link", { name: "Watch the keynote" })).toHaveAttribute(
    "href", "https://www.youtube.com/watch?v=ZWX5TfR1UAI"
  );
  await expect(page.getByRole("link", { name: "Watch the roadmap session" })).toHaveAttribute(
    "href", "https://www.youtube.com/watch?v=gJV4fZ7dpQw"
  );
  const images = page.locator('main img[src^="/images/unite-tokyo-2026/"]');
  await expect(images).toHaveCount(3);
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded();
    await image.evaluate((element: HTMLImageElement) => element.decode());
    await expect(image).toBeVisible();
  }
  const graphics = page.getByRole("region", { name: "Graphics, 2D, and UI" });
  await expect(graphics.getByRole("link", { name: "Watch the Atrio lighting demo" })).toHaveAttribute(
    "href", "https://www.youtube.com/watch?v=QfXsGwrBgVg"
  );
  await expect(graphics.getByRole("link", { name: "Watch Unity’s 2D feature demo" })).toHaveAttribute(
    "href", "https://www.youtube.com/watch?v=MKs5XZl5G9Y"
  );
  await expect(page.getByRole("link", { name: "Search 6.7 release notes" })).toHaveAttribute("href", "/explorer?minorLine=6000.7");
  await expect(page.getByRole("link", { name: "Search 7.0 release notes" })).toHaveAttribute("href", "/explorer?minorLine=7000.0");
  await page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "Development and collaboration tools" }).click();
  await expect(page).toHaveURL(/#tools$/);
  await expect(page.getByText("Stable 1.x", { exact: true })).toBeVisible();
  await expect(page.getByText("Beta · general availability planned for 2027", { exact: true })).toBeVisible();
  await expect(page.getByText("Editor plug-in and CLI experimental", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Hosted Pipeline docs" })).toHaveAttribute(
    "href", "https://docs.unity.com/en-us/unity-production-pipeline"
  );

  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished)));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`unite-tokyo-${theme}.png`), fullPage: true });
  }
  expect(await (await request.get("/sitemap.xml")).text()).toContain(`${path}</loc>`);
  expect(await (await request.get("/llms.txt")).text()).toContain(`${path})`);
  await page.goto("/resources");
  await expect(page.getByRole("link", { name: "Unite Tokyo 2026 guide" })).toHaveAttribute("href", path);
});
