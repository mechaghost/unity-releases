"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  PERSONA_PRESETS,
  personaCookieName,
  type PersonaPreset
} from "@/lib/filters";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Persist the persona preset for a view. Called from the filter drawer
 * when the user picks Director / Balanced / Indie. The preset becomes the
 * sticky default the next time they open that page; the URL still wins
 * over the cookie within a single session.
 */
export async function setPersonaPresetAction(
  view: "compare" | "release",
  preset: PersonaPreset
) {
  if (!(PERSONA_PRESETS as readonly string[]).includes(preset)) {
    return;
  }
  const jar = await cookies();
  jar.set(personaCookieName(view), preset, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax"
  });
  revalidatePath(view === "compare" ? "/compare" : "/releases", "layout");
}
