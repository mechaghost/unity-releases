import { expect, test, vi } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const reconcile = require("../../scripts/health-incident.cjs");
const moduleUrl = new URL("../../scripts/check-health.mjs", import.meta.url).href;

test("HTTP 200 stale, missing coverage, old timestamps and network errors fail monitoring", async () => {
  const { checkHealth } = await import(moduleUrl);
  const now = Date.parse("2026-11-04T12:00:00Z");
  const valid = { status: "ok", checkedAt: new Date(now).toISOString(), databaseConfigured: true, ingestion: [{}], configured: true, ingestionEnabled: true, sources: [{}] };
  expect((await checkHealth("https://example.test", async () => Response.json(valid), now)).status).toBe("ok");
  for (const bad of [{ ...valid, status: "stale" }, { ...valid, ingestion: [] }, { ...valid, ingestionEnabled: false }, { ...valid, checkedAt: "2026-01-01" }]) {
    expect((await checkHealth("https://example.test", async () => Response.json(bad), now)).status).toBe("failed");
  }
  expect((await checkHealth("https://example.test", async () => { throw new Error("offline"); }, now)).status).toBe("failed");
});

test("one incident per outage, only the monitor's own issue is closed on recovery", async () => {
  const api = { listForRepo: vi.fn(), create: vi.fn(), createComment: vi.fn(), update: vi.fn() };
  const github = { rest: { issues: api }, paginate: vi.fn().mockResolvedValue([]) };
  const context = { repo: { owner: "test", repo: "repo" }, serverUrl: "https://github.com", runId: 1 };
  await reconcile({ github, context, failed: true, details: "failed" });
  expect(api.create).toHaveBeenCalledOnce();
  const incident = { number: 2, user: { login: "github-actions[bot]" }, body: api.create.mock.calls[0][0].body };
  github.paginate.mockResolvedValue([{ ...incident, number: 1, user: { login: "someone" } }, incident]);
  await reconcile({ github, context, failed: true, details: "still failed" });
  expect(api.create).toHaveBeenCalledOnce();
  expect(api.createComment).not.toHaveBeenCalled();
  await reconcile({ github, context, failed: false });
  expect(api.update).toHaveBeenCalledWith(expect.objectContaining({ issue_number: 2, state: "closed" }));
});
