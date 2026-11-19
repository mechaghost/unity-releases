import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SOCIAL_PREVIEW_ALT, SOCIAL_PREVIEW_PATH, SOCIAL_PREVIEW_SIZE } from "@/lib/site";

export const dynamic = "force-static";
export const alt = SOCIAL_PREVIEW_ALT;
export const size = SOCIAL_PREVIEW_SIZE;
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const image = await readFile(join(process.cwd(), "public", SOCIAL_PREVIEW_PATH.slice(1)));
  return new Response(new Uint8Array(image), { headers: { "Content-Type": contentType } });
}
