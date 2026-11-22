import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const eventsPath = "/whats-new/events";
const events = [
  { name: "Unite Tokyo 2026", slug: "unite-tokyo-2026", day: "2026-11-17", keynote: "ZWX5TfR1UAI", roadmap: "gJV4fZ7dpQw" },
  { name: "Unite Seoul 2026", slug: "unite-seoul-2026", day: "2026-07-21", keynote: "ZTkvearTewE", roadmap: "M3ncIGe4s-0" }
];
const sampleTopics = [
  { event: events[0], name: "URP lighting and the Atrio sample", slug: "atrio-urp-lighting", total: 22,
    source: "Watch the Atrio lighting demo", video: "https://www.youtube.com/watch?v=QfXsGwrBgVg" },
  { event: events[1], name: "Dynamic lighting in URP", slug: "dynamic-lighting-in-urp", total: 12,
    source: "Watch the Surface Cache GI demo", video: "https://www.youtube.com/watch?v=n-3XvhUzMc0&t=1237s" }
];

test("event topics use the feature cards and open detail pages with official sources", async ({ page, request }, testInfo) => {
  const mobile = testInfo.project.name.startsWith("mobile");
  if (mobile) await page.setViewportSize({ width: 320, height: 850 });
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const sample of sampleTopics) {
    const eventPath = `/whats-new/${sample.event.slug}`;
    const topicPath = `${eventPath}/${sample.slug}`;
    await page.goto(`${eventPath}#graphics`);
    const cards = page.locator("main .guide-grid .guide-highlight > a.guide-feature-link");
    await expect(cards).toHaveCount(sample.total);
    const graphics = page.locator("#graphics");
    const graphicsCards = graphics.locator(".guide-grid .guide-highlight > .guide-feature-link");
    const illustrations = graphicsCards.locator(".guide-feature-image img");
    await expect(illustrations).toHaveCount(2);
    for (const image of await illustrations.all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((element: HTMLImageElement) => element.decode());
    }
    const first = (await graphicsCards.nth(0).boundingBox())!;
    const second = (await graphicsCards.nth(1).boundingBox())!;
    expect(first.width).toBeCloseTo(second.width, 0);
    if (mobile) expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
    else expect(second.y).toBe(first.y);
    await graphics.locator(".guide-grid").screenshot({ path: testInfo.outputPath(`${sample.event.slug}-topic-cards.png`) });

    const paths = await cards.evaluateAll(links => links.map(link => link.getAttribute("href")!));
    expect(new Set(paths).size).toBe(sample.total);
    for (const route of paths) expect(sitemap).toContain(`${route}</loc>`);

    const card = graphics.getByRole("link", { name: sample.name, exact: true });
    await expect(card).toHaveAttribute("href", topicPath);
    await card.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${topicPath}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(sample.name);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${topicPath}$`));
    await expect(page.getByRole("heading", { name: "What changed" })).toBeVisible();
    await expect(page.getByRole("link", { name: sample.source, exact: true })).toHaveAttribute("href", sample.video);
    await expect(page.getByRole("region", { name: "Related topics" }).getByRole("link").first()).toBeVisible();
    await page.locator("main .guide-figure img").evaluate((img: HTMLImageElement) => img.decode());
    if (mobile) await page.getByRole("button", { name: "Open navigation" }).click();
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(nav.getByRole("link", { name: "Events", exact: true })).toHaveAttribute("aria-current", "page");
    if (mobile) await page.keyboard.press("Escape");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`${sample.event.slug}-topic-detail.png`), fullPage: true });

    await page.getByRole("link", { name: /^Back to Graphics/ }).click();
    await expect(page).toHaveURL(new RegExp(`${eventPath}#graphics$`));
    expect((await request.get(`${eventPath}/unknown-topic`)).status()).toBe(404);
  }
});

test("event cards and guides share the feature layout and site navigation", async ({ page, request }, testInfo) => {
  const mobile = testInfo.project.name.startsWith("mobile");
  if (mobile) await page.setViewportSize({ width: 320, height: 850 });
  await page.goto("/");
  const homeEvents = page.getByRole("region", { name: "Events", exact: true });
  await expect(homeEvents.locator(".guide-grid .guide-highlight > a.guide-feature-link")).toHaveCount(2);
  for (const event of events) {
    const card = homeEvents.getByRole("link", { name: event.name, exact: true });
    await expect(card).toHaveAttribute("href", `/whats-new/${event.slug}`);
    await expect(card.locator(".guide-feature-footer time")).toHaveAttribute("datetime", event.day);
  }
  await homeEvents.getByRole("link", { name: "All events" }).click();
  await expect(page).toHaveURL(new RegExp(`${eventsPath}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Events");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${eventsPath}$`));
  const cards = page.locator("main .guide-grid .guide-highlight > a.guide-feature-link");
  await expect(cards).toHaveCount(2);
  for (const image of await cards.locator(".guide-feature-image img").all()) {
    await image.scrollIntoViewIfNeeded();
    await image.evaluate((element: HTMLImageElement) => element.decode());
  }
  const first = (await cards.first().boundingBox())!;
  const last = (await cards.last().boundingBox())!;
  expect(first.width).toBeCloseTo(last.width, 0);
  if (mobile) expect(last.y).toBeGreaterThanOrEqual(first.y + first.height);
  else expect(first.y).toBe(last.y);
  await page.screenshot({ path: testInfo.outputPath("events-index.png"), fullPage: true });

  for (const event of events) {
    const href = `/whats-new/${event.slug}`;
    await page.getByRole("main").getByRole("link", { name: event.name, exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(event.name);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${href}$`));
    await expect(page.getByRole("link", { name: "Watch the keynote", exact: true })).toHaveAttribute("href", `https://www.youtube.com/watch?v=${event.keynote}`);
    await expect(page.getByRole("link", { name: "Watch the roadmap session", exact: true })).toHaveAttribute("href", `https://www.youtube.com/watch?v=${event.roadmap}`);
    const images = page.locator(`main img[src^="/images/${event.slug}/"]`);
    await expect(images).toHaveCount(3);
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((element: HTMLImageElement) => element.decode());
    }
    if (mobile) await page.getByRole("button", { name: "Open navigation" }).click();
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(nav.getByRole("link", { name: "Events", exact: true })).toHaveAttribute("aria-current", "page");
    if (mobile) await page.keyboard.press("Escape");
    await expect(page.getByRole("navigation", { name: "Other events" }).getByRole("link", { name: events.find(other => other.slug !== event.slug)!.name })).toBeVisible();
    for (const theme of ["light", "dark"]) {
      await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
      await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished)));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`${event.slug}-${theme}.png`), fullPage: true });
    }
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Events", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${eventsPath}$`));
  }
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const llms = await (await request.get("/llms.txt")).text();
  for (const path of [eventsPath, ...events.map(event => `/whats-new/${event.slug}`)]) {
    expect(sitemap).toContain(`${path}</loc>`);
    expect(llms).toContain(`${path})`);
  }
});
