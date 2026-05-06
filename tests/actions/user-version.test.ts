import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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

import { setUserVersionAction } from "../../src/app/_actions/user-version";
import { USER_VERSION_COOKIE } from "../../src/lib/user-version";

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

describe("setUserVersionAction", () => {
  test("writes the picked version to the cookie", async () => {
    await setUserVersionAction(form([["version", "6000.0.74f1"]]));
    expect(mocks.cookieStore.set).toHaveBeenCalledWith(
      USER_VERSION_COOKIE,
      "6000.0.74f1",
      expect.objectContaining({ path: "/", sameSite: "lax" })
    );
  });

  test("trims whitespace around the supplied version", async () => {
    await setUserVersionAction(form([["version", "  6000.3.14f1  "]]));
    expect(mocks.cookieStore.set).toHaveBeenCalledWith(
      USER_VERSION_COOKIE,
      "6000.3.14f1",
      expect.any(Object)
    );
  });

  test("deletes the cookie when no version is supplied", async () => {
    await setUserVersionAction(form([]));
    expect(mocks.cookieStore.delete).toHaveBeenCalledWith(USER_VERSION_COOKIE);
    expect(mocks.cookieStore.set).not.toHaveBeenCalled();
  });

  test("deletes the cookie when an empty value is supplied", async () => {
    await setUserVersionAction(form([["version", "   "]]));
    expect(mocks.cookieStore.delete).toHaveBeenCalledWith(USER_VERSION_COOKIE);
    expect(mocks.cookieStore.set).not.toHaveBeenCalled();
  });

  test("revalidates the whole layout so every page rerenders with the new pick", async () => {
    await setUserVersionAction(form([["version", "6000.3.14f1"]]));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  test("uses a 1-year cookie maxAge", async () => {
    await setUserVersionAction(form([["version", "6000.3.14f1"]]));
    const opts = mocks.cookieStore.set.mock.calls[0]?.[2];
    expect(opts.maxAge).toBeGreaterThanOrEqual(60 * 60 * 24 * 365);
  });
});
