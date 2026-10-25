import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SentinelMark } from "./_components/SentinelMark";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-static";
export const alt = `${SITE_NAME} — Know what changed. Independent Unity release guides and version comparisons.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const inter = new Uint8Array(await readFile(join(process.cwd(), "src/app/fonts/Inter-ExtraBold.ttf"))).buffer;
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", background: "#FFFFFF", color: "#111318", display: "flex", flexDirection: "column", padding: "64px 72px", fontFamily: "Inter", borderBottom: "20px solid #2455F5" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
        <SentinelMark size={260} />
        <div style={{ display: "flex", flexDirection: "column", fontSize: 88, fontWeight: 800, lineHeight: 1, letterSpacing: -4 }}>
          <span>Unity</span><span>Releases</span>
        </div>
      </div>
      <div style={{ display: "flex", marginTop: 24, fontSize: 42, color: "#596174", fontWeight: 600 }}>Know what changed.</div>
      <div style={{ display: "flex", marginTop: 26, fontSize: 26, color: "#2455F5" }}>unityreleases.com</div>
      <div style={{ display: "flex", marginTop: "auto", fontSize: 17, color: "#596174" }}>Independent project. Not affiliated with Unity Technologies.</div>
    </div>,
    { ...size, fonts: [{ name: "Inter", data: inter, weight: 800, style: "normal" }] }
  );
}
