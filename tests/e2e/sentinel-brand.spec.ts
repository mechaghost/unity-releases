import sharp from "sharp";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("Sentinel keeps the same black-on-white face in both themes", async ({ page }) => {
  await page.goto("/releases");
  await page.evaluate(() => document.fonts.ready);
  const mobile = (page.viewportSize()?.width ?? 1440) <= 1024;
  const brand = page.locator(mobile ? ".mobile-topbar__brand" : ".lnav__brand");
  await expect(brand).toHaveAccessibleName(/Unity\s*Releases/);
  const mark = brand.locator("svg");
  await page.evaluate(() => document.documentElement.dataset.theme = "light");
  const light = await mark.screenshot({ animations: "disabled" });
  await page.evaluate(() => document.documentElement.dataset.theme = "dark");
  const dark = await mark.screenshot({ animations: "disabled" });
  // Compare the face, excluding transparent corners where the page theme shows through.
  const { width, height } = await sharp(light).metadata();
  const inset = Math.ceil(width! * 0.15);
  const face = { left: inset, top: inset, width: width! - inset * 2, height: height! - inset * 2 };
  const lightFace = await sharp(light).extract(face).raw().toBuffer();
  const darkFace = await sharp(dark).extract(face).raw().toBuffer();
  expect(darkFace.equals(lightFace), "dark mode must not invert the owl").toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
    // Let color transitions settle before measuring contrast.
    await page.waitForTimeout(250);
    const results = await new AxeBuilder({ page }).include(mobile ? ".mobile-topbar" : ".lnav")
      .withRules(["color-contrast", "link-name", "button-name"]).analyze();
    expect(results.violations).toEqual([]);
  }
  if (mobile) {
    const toggle = page.getByRole("button", { name: "Open navigation", exact: true });
    await toggle.click();
    await expect(page.locator(".lnav__brand")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  }
});

test("brand image endpoints return images and install metadata", async ({ request }) => {
  for (const route of ["/icon", "/apple-icon", "/opengraph-image", "/brand/sentinel-192.png", "/brand/sentinel-512.png"]) {
    const response = await request.get(route);
    expect(response.status(), route).toBe(200);
    expect(response.headers()["content-type"], route).toContain("image/png");
    expect((await response.body()).subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  }
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  expect((await manifest.json()).icons).toHaveLength(2);
});
