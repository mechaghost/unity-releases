import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// vi.mock factories are hoisted above any other top-level code, so the
// shared spy state has to be hoisted with vi.hoisted() to be reachable
// from inside the factories.
const mocks = vi.hoisted(() => ({
  cookieStore: {
    set: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(() => undefined)
  },
  revalidatePath: vi.fn()
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mocks.cookieStore)
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}));

import { setStreamFilterAction } from "../../src/app/_actions/stream-filter";
import { STREAM_FILTER_COOKIE } from "../../src/lib/stream-filter";

beforeEach(() => {
  mocks.cookieStore.set.mockClear();
  mocks.cookieStore.delete.mockClear();
  mocks.revalidatePath.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

function form(values: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [k, v] of values) fd.append(k, v);
  return fd;
}

describe("setStreamFilterAction", () => {
  test("writes the cookie with all four streams when the user checks them all", async () => {
    await setStreamFilterAction(
      form([
        ["streams", "LTS"],
        ["streams", "Update/Supported"],
        ["streams", "beta"],
        ["streams", "alpha"]
      ])
    );

    expect(mocks.cookieStore.set).toHaveBeenCalledWith(
      STREAM_FILTER_COOKIE,
      "LTS,Update/Supported,beta,alpha",
      expect.objectContaining({
        path: "/",
        sameSite: "lax"
      })
    );
  });

  test("writes an empty string when no boxes are checked", async () => {
    await setStreamFilterAction(form([]));
    expect(mocks.cookieStore.set).toHaveBeenCalledWith(
      STREAM_FILTER_COOKIE,
      "",
      expect.objectContaining({ path: "/", sameSite: "lax" })
    );
  });

  test("silently drops unknown stream values from the form", async () => {
    await setStreamFilterAction(
      form([
        ["streams", "LTS"],
        ["streams", "BOGUS"],
        ["streams", "alpha"]
      ])
    );
    expect(mocks.cookieStore.set).toHaveBeenCalledWith(
      STREAM_FILTER_COOKIE,
      "LTS,alpha",
      expect.any(Object)
    );
  });

  test("revalidates the layout so every page picks up the new filter", async () => {
    await setStreamFilterAction(form([["streams", "LTS"]]));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  test("uses a 1-year cookie maxAge so the preference sticks", async () => {
    await setStreamFilterAction(form([["streams", "LTS"]]));
    const opts = mocks.cookieStore.set.mock.calls[0]?.[2];
    expect(opts.maxAge).toBeGreaterThanOrEqual(60 * 60 * 24 * 365);
  });
});
