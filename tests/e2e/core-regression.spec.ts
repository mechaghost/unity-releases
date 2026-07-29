import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGE_CONTRACTS = [
  ["/", "Upgrade Intelligence"],
  [
    "/compare?from=6000.0.1f1&to=6000.0.2f1",
    /Unity 6000\.0\.1f1 to 6000\.0\.2f1 upgrade diff/
  ],
  ["/releases", "Editor Releases"],
  ["/releases/6000.0.2f1", "6000.0.2f1"],
  ["/visualizer", "Release Visualizer"],
  ["/explorer", "Release Notes Search"],
  ["/issues", "Issue Explorer"],
  ["/issues/UUM-10001", "UUM-10001"],
  ["/packages", "All Packages"],
  ["/github", "Unity GitHub"],
  ["/discussions", "Staff Discussions"],
  ["/timeline", "Activity & Ingestion Feed"],
  ["/news", "News"],
  ["/resources", "Resources"],
  ["/stats", "Site Stats"],
  ["/faq", "FAQ"],
  ["/updates", "Product Updates"],
  ["/updates/editor-tooling", "Editor Tooling Updates"],
  ["/updates/platform-services", "Platform & Services Updates"],
  ["/updates/products/unity-hub", "Unity Hub"],
  ["/updates/products/unity-hub/3.14.0", "Unity Hub 3.14.0"]
] as const satisfies ReadonlyArray<readonly [string, string | RegExp]>;

const HTTP_CONTRACTS = [
  "/compare.md?from=6000.0.1f1&to=6000.0.2f1",
  "/llms.txt",
  "/robots.txt",
  "/sitemap.xml",
  "/api/events",
  "/api/health",
  "/api/packages",
  "/api/packages/com.unity.inputsystem/versions",
  "/api/release-notes?q=UUM-10001",
  "/api/releases",
  "/api/updates",
  "/api/updates/health",
  "/icon",
  "/apple-icon",
  "/opengraph-image"
] as const;

test.describe("core surface contract", () => {
  for (const [path, heading] of PAGE_CONTRACTS) {
    test(`${path} preserves its primary surface`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth
        )
      ).toBe(true);
    });
  }

  for (const path of HTTP_CONTRACTS) {
    test(`${path} remains reachable`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status(), await response.text()).toBe(200);
    });
  }

  test("/upgrade preserves its compatibility redirect", async ({ request }) => {
    const response = await request.get("/upgrade?from=6000.0.1f1&to=6000.0.2f1", {
      maxRedirects: 0
    });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain("/compare?");
  });

  test("/api/track preserves its human-client contract", async ({ request }) => {
    const response = await request.post("/api/track", {
      headers: { "user-agent": "Mozilla/5.0 UnityReleasesContract/1.0" },
      data: { kind: "pageview", path: "/releases" }
    });
    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  test("public discovery follows the enabled Product Updates navigation", async ({
    request
  }) => {
    const sitemapResponse = await request.get("/sitemap.xml");
    expect(await sitemapResponse.text()).toContain(
      "/updates/products/unity-hub/3.14.0"
    );
    const llmsResponse = await request.get("/llms.txt");
    expect(await llmsResponse.text()).toContain(
      "## Secondary product intelligence"
    );
  });

  test("default activity surfaces stay core-only while product updates require explicit scope", async ({
    page,
    request
  }) => {
    const coreResponse = await request.get("/api/events");
    expect(coreResponse.status()).toBe(200);
    const coreBody = await coreResponse.json();
    expect(coreBody.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event_type: "unity_release" })
      ])
    );
    expect(coreBody.events).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event_type: "product_update" })
      ])
    );

    await page.goto("/timeline");
    await expect(page.getByText("Editor Released:")).toBeVisible();
    await expect(page.getByText("Unity Hub 3.14.0")).toHaveCount(0);

    await page.goto("/timeline?filter=products");
    await expect(page.locator(".timeline__card-time")).toContainText(
      "Jul 24, 2026"
    );
    await expect(
      page.getByRole("link", { name: /Product Update: Unity Hub 3\.14\.0/ })
    ).toBeVisible();
    await expect(page.getByText("Editor Released:")).toHaveCount(0);

    const productResponse = await request.get(
      "/api/events?scope=product-updates"
    );
    expect(productResponse.status()).toBe(200);
    await expect(productResponse.json()).resolves.toMatchObject({
      events: [
        expect.objectContaining({
          event_type: "product_update",
          title: "Unity Hub 3.14.0"
        })
      ]
    });
  });

  test("stats preserve core-first information architecture and isolate optional health", async ({
    page
  }) => {
    await page.goto("/stats");
    const headings = await page.locator("main h2").allTextContents();
    expect(headings.indexOf("Tracked Artifacts")).toBeLessThan(
      headings.indexOf("Ingestion Freshness")
    );
    expect(headings.indexOf("Ingestion Freshness")).toBeLessThan(
      headings.indexOf("Optional Product Updates")
    );
    const productUpdateCard = page
      .locator(".stats-card")
      .filter({ hasText: "Product updates" });
    await expect(productUpdateCard).toBeVisible();
    await expect(productUpdateCard.locator(".stats-card__value")).toHaveText("1");
  });

  test("product update dates preserve their UTC release day", async ({ page }) => {
    await page.goto("/updates");
    await expect(page.getByText("Jul 24, 2026", { exact: true })).toBeVisible();
  });

  test("Editor tooling makes product acquisition the primary action", async ({
    page
  }) => {
    await page.goto("/updates/editor-tooling");
    const actions = page.getByRole("region", { name: "Get the tools" });
    await expect(actions).toBeVisible();
    await expect(
      actions.getByRole("link", { name: "Download Unity Hub" })
    ).toHaveAttribute("href", "https://unity.com/download");
    await expect(
      actions.getByRole("link", { name: "Release history" })
    ).toHaveCount(1);

    await page.goto("/updates/products/unity-hub");
    await expect(
      page.getByRole("link", { name: "Download Unity Hub" })
    ).toHaveAttribute("class", /btn--primary/);
  });

  test("product browse filters are URL-stable and scoped to optional data", async ({
    page
  }) => {
    await page.goto(
      "/updates/editor-tooling?product=unity-hub&kind=improvement&platform=Windows&version=3.14.0&channel=stable&from=2026-07-01&to=2026-07-31"
    );
    await expect(
      page.getByRole("form", { name: "Product update filters" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Unity Hub 3.14.0" })
    ).toBeVisible();

    await page.goto("/updates/editor-tooling?channel=beta");
    await expect(page.getByText("Nothing published yet.")).toBeVisible();
  });

  test("desktop navigation preserves every existing destination and one current item", async ({
    page
  }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("desktop"), "desktop-only contract");
    await page.goto("/releases");
    const nav = page.getByRole("navigation", { name: "Primary" });
    for (const label of [
      "Upgrade Intelligence",
      "Editor Releases",
      "Release Visualizer",
      "Search Notes",
      "Issue Explorer",
      "Packages",
      "Editor Tooling Updates",
      "Product Updates",
      "Unity GitHub",
      "Staff Discussions",
      "Activity Feed",
      "News",
      "Resources",
      "Stats",
      "FAQ"
    ]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }
    for (const label of [
      "Engine & Editor",
      "Unity Products",
      "Community & Reference"
    ]) {
      await expect(nav.getByRole("heading", { name: label })).toBeVisible();
    }
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  });

  test("stable product detail routes keep exactly one navigation item current", async ({
    page
  }, testInfo) => {
    await page.goto("/updates/products/unity-hub/3.14.0");
    if (testInfo.project.name.startsWith("mobile")) {
      await page.getByRole("button", { name: "Open navigation" }).click();
    }
    const nav = page.locator("#primary-nav");
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(
      nav.getByRole("link", { name: "Product Updates" })
    ).toHaveAttribute("aria-current", "page");
  });

  test("mobile drawer opens, closes with Escape, and restores focus", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("mobile"), "mobile-only contract");
    await page.goto("/releases");
    const toggle = page.getByRole("button", { name: "Open navigation" });
    await toggle.focus();
    await toggle.click();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
  });

  test("core pages have no critical automated accessibility violations", async ({ page }) => {
    await page.goto("/releases");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((violation) => violation.impact === "critical")).toEqual([]);
  });
});
