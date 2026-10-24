import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const populated = [
  { section: "Editor releases", title: "Unity 6000.0.2f1", date: "2026-07-15", destination: ".releases-table tbody tr", match: "6000.0.2f1" },
  { section: "Packages", title: "Input System 1.11.2", date: "2026-07-10", destination: ".dense-table tbody tr", match: "Input System" },
  { section: "Editor tools", title: "Unity Hub 3.14.0", date: "2026-07-24", destination: ".product-update-list > li", match: "Unity Hub 3.14.0" },
  { section: "Product updates", title: "Pagination Product 1.0.1", date: "2026-07-27", destination: ".product-update-list > li", match: "Pagination Product 1.0.1" },
  { section: "Reported issues", title: "UUM-10001", date: "2026-07-01", destination: ".issue-table tbody tr", match: "UUM-10001" },
  { section: "News", title: "Deterministic Unity news fixture", date: "2026-07-20", destination: ".news-row", match: "Deterministic Unity news fixture" },
  { section: "Resources", title: "Deterministic Unity resource fixture", date: "2026-07-18", destination: ".resource-card", match: "Deterministic Unity resource fixture" }
];

for (const path of ["/", "/whats-new"]) {
  test(`${path} shows dated updates and honest empty sources`, async ({ page, request }) => {
    await page.goto(path);
    const section = page.getByRole("region", { name: "More updates" });
    const cards = section.locator("a.update-section-card");
    await expect(cards).toHaveCount(9);
    for (const expected of populated) {
      const card = cards.filter({ has: page.getByRole("heading", { name: expected.section, exact: true }) });
      await expect(card.locator(".update-section-card__title")).toContainText(expected.title);
      await expect(card.locator("time")).toHaveAttribute("datetime", new RegExp(`^${expected.date}`));
      await expect(card).not.toContainText("Updates unavailable");
    }
    // These sources intentionally have no fixture rows. They must not borrow
    // another source's date or fall back to promotional placeholder copy.
    for (const name of ["Staff discussions", "Unity GitHub"]) {
      const card = cards.filter({ has: page.getByRole("heading", { name, exact: true }) });
      await expect(card).toContainText("No updates indexed");
      await expect(card.locator("time")).toHaveCount(0);
    }
    const news = cards.filter({ has: page.getByRole("heading", { name: "News", exact: true }) });
    await expect(news.locator("time")).not.toHaveAttribute("datetime", /^2026-07-28/);
    const issue = cards.filter({ has: page.getByRole("heading", { name: "Reported issues", exact: true }) });
    await expect(issue).toContainText("First noted");
    // A package publication is not its discovery time or its bundled Editor date.
    const pkg = cards.filter({ has: page.getByRole("heading", { name: "Packages", exact: true }) });
    await expect(pkg).toContainText("Published");
    for (const href of await cards.evaluateAll(elements => elements.map(element => element.getAttribute("href")!))) {
      expect(href.startsWith("/")).toBe(true);
      const response = await request.get(href);
      expect(response.status(), href).toBe(200);
    }
  });
}

test("update cards lead to the section containing the advertised item first", async ({ page }) => {
  for (const expected of populated) {
    await page.goto("/");
    const card = page.locator(".update-section-card").filter({ has: page.getByRole("heading", { name: expected.section, exact: true }) });
    const href = await card.getAttribute("href");
    await card.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new URL(href!, page.url()).href);
    await expect(page.locator(expected.destination).first()).toContainText(expected.match);
  }
});

test("update cards remain readable and accessible in both themes", async ({ page }, testInfo) => {
  if (testInfo.project.name.startsWith("mobile")) await page.setViewportSize({ width: 320, height: 850 });
  await page.goto("/");
  const section = page.getByRole("region", { name: "More updates" });
  await section.scrollIntoViewIfNeeded();
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished)));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await section.screenshot({ path: testInfo.outputPath(`latest-updates-${theme}.png`) });
    expect((await new AxeBuilder({ page }).include(".more-updates").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  }
});
