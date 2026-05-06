"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ALL_STREAMS, STREAM_FILTER_COOKIE } from "@/lib/stream-filter";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function setStreamFilterAction(formData: FormData) {
  const requested = formData
    .getAll("streams")
    .map(String)
    .filter((s): s is (typeof ALL_STREAMS)[number] =>
      (ALL_STREAMS as readonly string[]).includes(s)
    );
  const jar = await cookies();
  jar.set(STREAM_FILTER_COOKIE, requested.join(","), {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax"
  });
  revalidatePath("/", "layout");
}
