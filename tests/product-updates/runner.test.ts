import { describe, expect, test } from "vitest";
import { ProductUpdateHttpError } from "../../src/lib/product-updates/fetcher";
import { classifyProductUpdateFailure } from "../../src/lib/product-updates/runner";

describe("Product Updates failure classification", () => {
  test("distinguishes volatile upstream states from parser drift", () => {
    expect(
      classifyProductUpdateFailure(
        new ProductUpdateHttpError(429, "https://unity.com/source", 1_000),
        "fetch"
      )
    ).toBe("rate-limited");
    expect(
      classifyProductUpdateFailure(
        new ProductUpdateHttpError(404, "https://unity.com/source", null),
        "fetch"
      )
    ).toBe("not-found-candidate");
    expect(
      classifyProductUpdateFailure(
        new ProductUpdateHttpError(403, "https://unity.com/source", null),
        "fetch"
      )
    ).toBe("access-configuration-blocked");
    expect(
      classifyProductUpdateFailure(
        new ProductUpdateHttpError(503, "https://unity.com/source", null),
        "fetch"
      )
    ).toBe("transient");
    expect(
      classifyProductUpdateFailure(new Error("markup changed"), "parse")
    ).toBe("parser-drift");
  });
});
