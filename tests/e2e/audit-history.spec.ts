import { expect, test } from "@playwright/test";

test("issue paging retains complete status, count and older major scope", async ({ page }) => {
  await page.goto("/issues/UUM-99155");
  await expect(page.locator("main")).toContainText("Mentioned in 155 release notes.");
  await expect(page.locator("main")).toContainText("First fixed in 2022.3.1f1");
  await expect(page.locator("tbody tr")).toHaveCount(100);
  await page.getByRole("navigation", { name: "Pagination" }).getByRole("link", { name: "Next", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(55);
  await expect(page.locator("main")).toContainText("Mentioned in 155 release notes.");
  await expect(page.locator("main")).toContainText("First fixed in 2022.3.1f1");
  await expect(page.locator("main")).toContainText("Audit history earliest legacy fix");
  await page.locator('a[href="/issues/UUM-99155?major=2022"]').click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
});

test("search pagination reaches all matches and preserves repeated filters", async ({ page }) => {
  await page.goto("/explorer?issue=UUM-99155&risk=info&risk=caution");
  await expect(page.locator(".list-toolbar__count")).toContainText("155 matches");
  await expect(page.locator("article.row")).toHaveCount(100);
  await page.getByRole("navigation", { name: "Pagination" }).getByRole("link", { name: "Next", exact: true }).click();
  await expect(page.locator("article.row")).toHaveCount(55);
  expect(new URL(page.url()).searchParams.getAll("risk")).toEqual(["info", "caution"]);
  await expect(page.locator("main")).toContainText("Audit history earliest legacy fix");
  await page.goto("/explorer?issue=UUM-99155&page=999");
  await expect(page.getByRole("navigation", { name: "Pagination" })).toContainText("Page 2 of 2");
});

test("resources pagination keeps selected types and exposes older entries", async ({ page }) => {
  await page.goto("/resources?q=audit-history&type=Article&type=Video");
  await expect(page.locator(".resource-card")).toHaveCount(200);
  await page.getByRole("navigation", { name: "Pagination" }).getByRole("link", { name: "Next", exact: true }).click();
  await expect(page.locator(".resource-card")).toHaveCount(5);
  expect(new URL(page.url()).searchParams.getAll("type")).toEqual(["Article", "Video"]);
  await expect(page.locator(".resource-card").first()).toContainText("Audit-history resource 201");
});

test("package dialog recovers after closing an in-flight request and reaches older history", async ({ page }) => {
  let started!: () => void;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { started = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  await page.route("**/api/packages/com.unity.audit-history/versions?*", async route => {
    calls += 1;
    if (calls === 1) {
      started();
      await held;
      await route.abort().catch(() => undefined);
      return;
    }
    await route.continue();
  });
  await page.goto("/packages?q=com.unity.audit-history&q=ignored");
  const opener = page.getByRole("button", { name: "Show release notes for Audit History" });
  await opener.click();
  await pending;
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  release();
  await opener.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".pkg-version__num").first()).toHaveText("1.0.55");
  await dialog.getByRole("button", { name: "Older versions" }).click();
  await expect(dialog.locator(".pkg-version__num")).toHaveCount(5);
  await expect(dialog.locator(".pkg-version__num").last()).toHaveText("1.0.1");
  await expect(dialog).toContainText("Showing 51–55 of 55 indexed versions.");
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test("package dialog retries failed requests without a page reload", async ({ page }) => {
  let fail = true;
  await page.route("**/api/packages/com.unity.audit-history/versions?*", async route => {
    if (fail) {
      fail = false;
      await route.fulfill({ status: 503, body: "Temporary failure" });
    } else await route.continue();
  });
  await page.goto("/packages?q=com.unity.audit-history");
  await page.getByRole("button", { name: "Show release notes for Audit History" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("alert")).toContainText("Couldn't load versions");
  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect(dialog.locator(".pkg-version__num")).toHaveCount(50);
});
