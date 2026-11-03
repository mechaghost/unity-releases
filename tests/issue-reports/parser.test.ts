import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { normalizeIssueId, parseIssueReport, trackerHtmlRedirect, trackerPageUnavailable, validatedTrackerUrl } from "../../src/lib/parsers/issue-report";
const customer = readFileSync("tests/fixtures/issue-reports/customer.html", "utf8");
const streamedMissing = readFileSync("tests/fixtures/issue-reports/streamed-not-found.html", "utf8");

describe("tracker report parsing", () => {
  test("follows only a corroborated streamed not-found shell, without declaring it unavailable", () => {
    const url = "https://issuetracker.unity.com/issues/24434";
    expect(trackerHtmlRedirect(streamedMissing, url)).toBe("https://issuetracker.unity.com/not-found");
    expect(trackerPageUnavailable(streamedMissing, url)).toBe(false);
    expect(() => parseIssueReport(streamedMissing, "UUM-151146")).toThrow(/identity/);
    for (const html of [
      streamedMissing.replace('data-dgst="NEXT_HTTP_ERROR_FALLBACK;404"', 'data-dgst="other"'),
      streamedMissing.replace("NEXT_REDIRECT;replace;/not-found;307;", "NEXT_REDIRECT;replace;https://example.com/;307;"),
      streamedMissing.replace("4:E{", "4:E{broken"),
      streamedMissing + "<h1>Verify you are human</h1>",
      streamedMissing + customer,
      streamedMissing + customer.replace(/<h1>[\s\S]*?<\/h1>/, "").replace(/<div class="issue-description">[\s\S]*?<\/div>/, "")
    ]) expect(trackerHtmlRedirect(html, url)).toBeNull();
  });
  test("extracts the customer's identity, title and description without navigation", () => {
    const report = parseIssueReport(customer, "UUM-145761");
    expect(report.title).toContain("fd < sysconf(_SC_OPEN_MAX)");
    expect(report.description).toContain("file descriptor");
    expect(report.description).toContain("not out of descriptors");
    expect(report.description).not.toContain("unrelated-cookie-noise");
    expect(report.descriptionTruncated).toBe(false);
  });
  test("parses the modern destination of a legacy link", () => {
    expect(parseIssueReport(readFileSync("tests/fixtures/issue-reports/legacy.html", "utf8"), "UUM-125366").title).toContain("Font Atlas");
  });
  test("accepts a verified empty description, rejects missing structures and wrong identity", () => {
    const empty = customer.replace(/<div class="issue-description">[\s\S]*?<\/div>/, '<div class="issue-description"></div>');
    expect(parseIssueReport(empty, "UUM-145761").description).toBe("");
    expect(() => parseIssueReport(customer, "UUM-2")).toThrow(/identity/);
    expect(() => parseIssueReport("<h1>Search results UUM-145761</h1>", "UUM-145761")).toThrow();
    expect(() => parseIssueReport(customer.replace('class="issue-description"', 'class="changed"'), "UUM-145761")).toThrow(/structure/);
  });
  test("discloses bounded descriptions and never treats script redirects as missing reports", () => {
    const long = customer.replace('<div class="issue-description">', '<div class="issue-description">' + "word ".repeat(4000));
    expect(parseIssueReport(long, "UUM-145761")).toMatchObject({ descriptionTruncated: true });
    expect(parseIssueReport(long, "UUM-145761").description.length).toBe(16000);
    expect(trackerPageUnavailable(customer + "NEXT_REDIRECT;replace;/not-found;307;", "https://issuetracker.unity.com/issues/1/example")).toBe(false);
  });
  test.each(["http://issuetracker.unity.com/issues/1", "https://example.com/", "https://issuetracker.unity.com:4430/", "https://user@issuetracker.unity.com/", "https://issuetracker.unity.com.evil.test/"])("rejects unsafe URL %s", url => {
    expect(() => validatedTrackerUrl(url)).toThrow();
  });
  test("validates HTML redirect destinations", () => {
    expect(trackerHtmlRedirect('<meta http-equiv="refresh" content="1;url=/issues/1/example">', "https://issuetracker.unity.com/issues/1")).toBe("https://issuetracker.unity.com/issues/1/example");
    expect(() => trackerHtmlRedirect('<meta http-equiv="refresh" content="1;url=https://example.com/">', "https://issuetracker.unity.com/issues/1")).toThrow();
    expect(normalizeIssueId(" uum-145761 ")).toBe("UUM-145761");
  });
});
