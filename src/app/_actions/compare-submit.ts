"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { USER_VERSION_COOKIE } from "@/lib/user-version";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Submitting the compare form treats the `from` value as the user's
 * Unity version too, so we don't need a separate "Your Unity version"
 * widget on the page.
 */
export async function submitCompareAction(formData: FormData) {
  const from = String(formData.get("from") ?? "").trim();
  const to = String(formData.get("to") ?? "").trim();
  const platform = String(formData.get("platform") ?? "").trim();

  if (from) {
    const jar = await cookies();
    jar.set(USER_VERSION_COOKIE, from, {
      path: "/",
      maxAge: ONE_YEAR_SECONDS,
      sameSite: "lax"
    });
  }

  // Repeated `stream=` hidden inputs from the picker form preserve the
  // user's stream scope across a compare submit — the URL is the sole
  // source of truth for the scope, so we have to round-trip it here.
  const streams = formData
    .getAll("stream")
    .map((s) => String(s).trim())
    .filter(Boolean);

  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (platform) params.set("platform", platform);
  for (const s of streams) params.append("stream", s);
  redirect(`/compare?${params.toString()}`);
}
