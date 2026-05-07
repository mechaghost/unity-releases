import { cookies } from "next/headers";

export const USER_VERSION_COOKIE = "unity-releases-version";

/** Read the user's chosen "current" Unity version from the request cookie. */
export async function getUserVersion(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(USER_VERSION_COOKIE)?.value?.trim();
  return value || null;
}
