import { expect, test } from "@playwright/test";

test("closing filters immediately keeps the last search edit", async ({ page }) => {
  await page.goto("/releases/6000.0.2f1");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Filter results" });
  await dialog.getByRole("button", { name: "Search", exact: true }).click();
  // Hold the debounce timer so this tests Done, rather than accidentally
  // passing because the automatic apply ran while the browser was busy.
  await page.evaluate(() => {
    const schedule = window.setTimeout.bind(window);
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) =>
      schedule(handler, delay === 300 ? 60_000 : delay, ...args)) as typeof window.setTimeout;
  });
  await dialog.getByPlaceholder("memory leak, GC.Alloc, compute shader…").fill("render");
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page).toHaveURL(/\?q=render$/);
  await expect(dialog).not.toBeVisible();
});

test("package dialog keeps keyboard focus with feature guides closed or open", async ({ page }) => {
  await page.goto("/packages?q=com.unity.render-pipelines.universal");
  const opener = page.getByRole("button", { name: /Show release notes for/ }).first();
  await opener.click();
  const dialog = page.getByRole("dialog");
  const close = dialog.getByRole("button", { name: "Close", exact: true });
  const summary = dialog.locator("summary").filter({ hasText: "Feature guides" });
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(summary).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await summary.click();
  const lastLink = dialog.locator(".guide-support a").last();
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(lastLink).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await expect(page.locator(".app-shell")).toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
  await expect(page.locator(".app-shell")).not.toHaveAttribute("inert");
});

test("mobile navigation contains focus and restores the page after closing", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const opener = page.getByRole("button", { name: "Open navigation" });
  await opener.click();
  const closer = page.getByRole("button", { name: "Close navigation", exact: true }).first();
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.locator("a").first()).toBeFocused();
  await expect(page.locator("main")).toHaveAttribute("inert", "");
  await nav.getByRole("button").last().focus();
  await page.keyboard.press("Tab");
  await expect(closer).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(nav.getByRole("button").last()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await expect(page.locator("main")).not.toHaveAttribute("inert");
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});
