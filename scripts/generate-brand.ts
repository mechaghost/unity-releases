/** Rebuild the downloadable icons from the same geometry as the UI and OG card. */
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { sentinelSvg } from "../src/lib/sentinel";

await mkdir("public/brand", { recursive: true });
const svg = sentinelSvg();
await writeFile("public/brand/sentinel.svg", svg + "\n");
for (const size of [16, 32, 48, 180, 192, 512]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/brand/sentinel-${size}.png`);
}
