"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { USER_PACKAGES_COOKIE, parseManifestInput } from "@/lib/user-packages";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function setUserPackagesAction(formData: FormData) {
  const raw = String(formData.get("manifest") ?? "");
  const packages = parseManifestInput(raw);
  const jar = await cookies();
  if (packages.length === 0) {
    jar.delete(USER_PACKAGES_COOKIE);
  } else {
    jar.set(USER_PACKAGES_COOKIE, packages.join(","), {
      path: "/",
      maxAge: ONE_YEAR_SECONDS,
      sameSite: "lax"
    });
  }
  revalidatePath("/", "layout");
}

export async function clearUserPackagesAction() {
  const jar = await cookies();
  jar.delete(USER_PACKAGES_COOKIE);
  revalidatePath("/", "layout");
}
