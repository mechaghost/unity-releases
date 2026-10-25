import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { scopedDatabaseUrl } from "./test-database";

test("home navigation is uniform and refresh time follows the visitor timezone", async ({ browser }, testInfo) => {
  const client = new Client({ connectionString: scopedDatabaseUrl() });
  await client.connect();
  const { rows } = await client.query("INSERT INTO ingestion_runs(source_type,job_name,parser_version,status,finished_at) VALUES ('editor_release','header-test','test','success','2099-01-15T18:30:00Z') RETURNING id");
  const context = await browser.newContext({ ...testInfo.project.use, locale: "en-US", timezoneId: "America/Los_Angeles" });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator(".guide-hero a[href='/compare']")).toHaveCount(0);
    await expect(page.locator(".guide-updated time")).toHaveText("Jan 15, 2099, 10:30 AM PST");
    await expect(page.locator(".guide-updated time")).toHaveAttribute("datetime", "2099-01-15T18:30:00.000Z");
    const links = page.getByRole("navigation", { name: "Browse release guides" }).getByRole("link");
    await expect(links).toHaveCount(2);
    const boxes = await Promise.all([links.nth(0).boundingBox(), links.nth(1).boundingBox()]);
    expect(boxes[0]!.y).toBe(boxes[1]!.y);
    const fonts = await links.evaluateAll(els => els.map(el => getComputedStyle(el).fontSize));
    expect(fonts[0]).toBe(fonts[1]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("home-header.png"), fullPage: true });
  } finally {
    await context.close();
    await client.query("DELETE FROM ingestion_runs WHERE id=$1", [rows[0].id]);
    await client.end();
  }
});
