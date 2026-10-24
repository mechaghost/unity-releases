import { expect, test } from "@playwright/test";

test("technical release notes link back to their release family guide", async ({ page }) => {
  await page.goto("/releases/6000.0.2f1");
  const link = page.getByRole("link", { name: "Unity 6.0 feature guide", exact: true });
  await expect(link).toHaveAttribute("href", "/whats-new/unity-6-0");
  await link.click();
  await expect(page.getByRole("heading", { level: 1, name: "What’s new in Unity 6.0?" })).toBeVisible();
});

test("package dialogs link to relevant feature details and retain the route back to packages", async ({ page }) => {
  await page.goto("/packages?q=com.unity.render-pipelines.universal");
  await page.getByRole("button", { name: "Show release notes for Universal RP", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Universal RP", exact: true });
  await expect(dialog).toBeVisible();
  const guides = dialog.locator("details").filter({ has: page.locator("summary", { hasText: "Feature guides" }) });
  await guides.locator("summary").focus();
  await page.keyboard.press("Enter");
  const featureLink = guides.getByRole("link", { name: "Reduce processor workload — Unity 6.0", exact: true });
  await expect(featureLink).toBeVisible();
  await expect(featureLink).toHaveAttribute("href", "/whats-new/unity-6-0/gpu-resident-drawer");
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await featureLink.click();
  await expect(page.getByRole("heading", { level: 1, name: "Reduce processor workload", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Check package versions", exact: true }).click();
  await expect(page.locator('input[name="q"]')).toHaveValue("com.unity.render-pipelines.universal");
});

test("packages without editorial associations do not show unrelated feature guides", async ({ page }) => {
  await page.goto("/packages?q=com.unity.inputsystem");
  await page.getByRole("button", { name: "Show release notes for Input System", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Input System", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("summary", { hasText: "Feature guides" })).toHaveCount(0);
});
