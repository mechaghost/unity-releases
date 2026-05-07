"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  MAX_SAVED_PRESETS,
  MAX_PRESET_NAME_LENGTH,
  PERSONA_PRESETS,
  parseSavedPresetsCookie,
  personaCookieName,
  savedPresetsCookieName,
  serializeSavedPresetsCookie,
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

/**
 * Add (or overwrite-by-name) a saved filter preset for the view. Caps
 * the saved-presets cookie at MAX_SAVED_PRESETS entries; the oldest
 * preset is dropped if the user is at the limit and adding a new name.
 */
export async function saveFilterPresetAction(
  view: "compare" | "release",
  name: string,
  qs: string
) {
  const trimmed = name.trim().slice(0, MAX_PRESET_NAME_LENGTH);
  if (!trimmed) return;
  const jar = await cookies();
  const existing = parseSavedPresetsCookie(jar.get(savedPresetsCookieName(view))?.value);
  const withoutDup = existing.filter((p) => p.name !== trimmed);
  const next = [{ name: trimmed, qs }, ...withoutDup].slice(0, MAX_SAVED_PRESETS);
  jar.set(savedPresetsCookieName(view), serializeSavedPresetsCookie(next), {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax"
  });
  revalidatePath(view === "compare" ? "/compare" : "/releases", "layout");
}

/**
 * Remove a saved preset by name.
 */
export async function deleteFilterPresetAction(
  view: "compare" | "release",
  name: string
) {
  const jar = await cookies();
  const existing = parseSavedPresetsCookie(jar.get(savedPresetsCookieName(view))?.value);
  const next = existing.filter((p) => p.name !== name);
  if (next.length === 0) {
    jar.delete(savedPresetsCookieName(view));
  } else {
    jar.set(savedPresetsCookieName(view), serializeSavedPresetsCookie(next), {
      path: "/",
      maxAge: ONE_YEAR_SECONDS,
      sameSite: "lax"
    });
  }
  revalidatePath(view === "compare" ? "/compare" : "/releases", "layout");
}
