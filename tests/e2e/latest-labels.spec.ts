import { expect, test } from "@playwright/test";

test("release browsing includes Supported updates by default and keeps previews opt-in", async ({ page }) => {
  await page.goto("/releases");
  await expect(page.getByText("Newest stable releases · LTS and Supported")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Supported", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Beta", exact: true })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Alpha", exact: true })).not.toBeChecked();
  await page.goto("/releases?stream=lts");
  await expect(page.getByRole("checkbox", { name: "Supported", exact: true })).not.toBeChecked();
});

test("package versions and dates identify the registry source", async ({ page }) => {
  await page.goto("/packages");
  await expect(page.locator(".packages-table thead")).toContainText("Registry version");
  await expect(page.locator(".packages-table thead")).toContainText("Registry updated");
  await expect(page.locator('.packages-table td[data-label="Registry version"]').first()).toBeVisible();
  await expect(page.locator('.packages-table td[data-label="Registry updated"]').first()).toBeVisible();
});


test("notes only link to indexed versions, including future fix mentions", async ({ page }) => {
  await page.goto("/releases/6000.0.2f1");
  const note = page.locator(".row").filter({ hasText: "Also fixed in 7000.0.0a13" });
  await expect(note.locator('a[href="/releases/6000.0.1f1"]')).toHaveCount(1);
  await expect(note.getByText("7000.0.0a13", { exact: true })).toBeVisible();
  await expect(note.locator('a[href="/releases/7000.0.0a13"]')).toHaveCount(0);
});
