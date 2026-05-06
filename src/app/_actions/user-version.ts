"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { USER_VERSION_COOKIE } from "@/lib/user-version";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function setUserVersionAction(formData: FormData) {
  const version = String(formData.get("version") ?? "").trim();
  const jar = await cookies();
  if (!version) {
    jar.delete(USER_VERSION_COOKIE);
  } else {
    jar.set(USER_VERSION_COOKIE, version, {
      path: "/",
      maxAge: ONE_YEAR_SECONDS,
      sameSite: "lax"
    });
  }
  // Revalidate everything; the user version affects diff URLs across the app.
  revalidatePath("/", "layout");
}
