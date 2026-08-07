import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("../../src/lib/db/client", () => ({
  query: mocks.query,
  getPool: vi.fn()
}));

import { runAllInvariants, runInvariant, summarize } from "../../src/jobs/check-invariants";
import { INVARIANTS, type Invariant } from "../../src/lib/invariants";

const CHECK: Invariant = {
  name: "test: nothing corrupt",
  severity: "error",
  describe: "why it matters",
  sql: "SELECT 0 AS n, NULL AS sample"
};

beforeEach(() => mocks.query.mockReset());
afterEach(() => vi.clearAllMocks());

describe("runInvariant", () => {
  test("passes when the offending-row count is zero", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ n: 0, sample: null }] });
    const r = await runInvariant(CHECK);
    expect(r.ok).toBe(true);
    expect(r.count).toBe(0);
  });

  test("fails and carries a sample when rows are found", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ n: 14, sample: "Text 1" }] });
    const r = await runInvariant(CHECK);
    expect(r.ok).toBe(false);
    expect(r.count).toBe(14);
    // The sample is what makes a red run actionable rather than a mystery.
    expect(r.sample).toBe("Text 1");
    expect(r.describe).toBe("why it matters");
  });

  test("honours a threshold for checks that tolerate a known baseline", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ n: 5, sample: "x" }] });
    expect((await runInvariant({ ...CHECK, threshold: 10 })).ok).toBe(true);
    mocks.query.mockResolvedValueOnce({ rows: [{ n: 11, sample: "x" }] });
    expect((await runInvariant({ ...CHECK, threshold: 10 })).ok).toBe(false);
  });

  test("coerces bigint counts returned as strings", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ n: "3", sample: null }] });
    const r = await runInvariant(CHECK);
    expect(r.count).toBe(3);
    expect(r.ok).toBe(false);
  });

  test("a check that cannot run is itself a failure, never silent", async () => {
    // A renamed column or dropped table must not read as "all clear" -
    // that is the exact silence this whole job exists to remove.
    mocks.query.mockRejectedValueOnce(new Error('column "title" does not exist'));
    const r = await runInvariant(CHECK);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/does not exist/);
  });
});

describe("summarize", () => {
  test("separates error breaches from warnings", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ n: 1, sample: "bad" }] })
      .mockResolvedValueOnce({ rows: [{ n: 2, sample: "smelly" }] })
      .mockResolvedValueOnce({ rows: [{ n: 0, sample: null }] });
    const results = await runAllInvariants([
      { ...CHECK, name: "e", severity: "error" },
      { ...CHECK, name: "w", severity: "warn" },
      { ...CHECK, name: "ok", severity: "error" }
    ]);
    expect(summarize(results)).toEqual({
      total: 3,
      passed: 1,
      errors: 1,
      warnings: 1
    });
  });

  test("only error-severity breaches should fail a cron run", async () => {
    mocks.query.mockResolvedValue({ rows: [{ n: 4, sample: "s" }] });
    const results = await runAllInvariants([{ ...CHECK, severity: "warn" }]);
    expect(summarize(results).errors).toBe(0);
  });
});

describe("the shipped invariant set", () => {
  test("every check is well-formed", () => {
    expect(INVARIANTS.length).toBeGreaterThan(10);
    for (const inv of INVARIANTS) {
      expect(inv.name, "name").toBeTruthy();
      expect(inv.describe.length, `${inv.name}: describe`).toBeGreaterThan(30);
      expect(inv.sql, `${inv.name}: sql`).toMatch(/SELECT/i);
      // Every check must project both columns the runner reads.
      expect(inv.sql, `${inv.name}: needs AS n`).toMatch(/\bAS n\b/);
      expect(inv.sql, `${inv.name}: needs sample`).toMatch(/sample/);
      expect(["error", "warn"]).toContain(inv.severity);
    }
  });

  test("check names are unique so a breach is unambiguous", () => {
    const names = INVARIANTS.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test("covers the bug classes that actually reached production", () => {
    const names = INVARIANTS.map((i) => i.name).join("\n");
    expect(names).toMatch(/decoy values/);          // "Text 1"
    expect(names).toMatch(/backslash/);             // `Madbox achieves \`
    expect(names).toMatch(/placeholder tokens/);    // `$3a`
    expect(names).toMatch(/HTML entities/);         // `&#x2192;`
    expect(names).toMatch(/degenerate/);            // all-'updated' change_kind
    expect(names).toMatch(/pre-unified-era/);       // 2019 SRP rows
    expect(names).toMatch(/Flight reader/);         // parser silently degraded
  });

  test("read-only: no check mutates data", () => {
    for (const inv of INVARIANTS) {
      expect(inv.sql, inv.name).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i);
    }
  });
});
