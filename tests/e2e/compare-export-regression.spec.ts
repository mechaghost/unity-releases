import { expect, test } from "@playwright/test";

// A mixed scope catches links that silently fall back to LTS on export.
test("comparison exports and metadata preserve every selected stream", async ({ page }) => {
  await page.goto("/compare?from=6000.0.1f1&to=6000.0.2f1&stream=LTS&stream=Update%2FSupported&stream=beta");
  const copiedUrl = await page.getByRole("button", { name: "Copy LLM-ready URL" }).getAttribute("title");
  expect(new URL(copiedUrl!).searchParams.getAll("stream")).toEqual(["LTS", "Update/Supported", "beta"]);
  const alternate = await page.locator('link[rel="alternate"][type="text/markdown"]').getAttribute("href");
  expect(new URL(alternate!, page.url()).searchParams.getAll("stream")).toEqual(["LTS", "Update/Supported", "beta"]);
  const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(new URL(canonical!).searchParams.getAll("stream")).toEqual(["LTS", "Update/Supported", "beta"]);
  const fetchedExport = page.waitForRequest(request => new URL(request.url()).pathname === "/compare.md");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Release Data" }).click();
  expect(new URL((await fetchedExport).url()).searchParams.getAll("stream")).toEqual(["LTS", "Update/Supported", "beta"]);
  expect((await downloaded).suggestedFilename()).toBe("unity-6000.0.1f1-to-6000.0.2f1-upgrade.md");
});
