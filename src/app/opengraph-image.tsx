import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export const alt =
  "Unity Releases — Unity 6 release & upgrade intelligence. Diff editor versions, see blockers, breaking changes, and known issues bucketed by impact.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Default Open Graph / Twitter card image. Dark background, accent
 * stripe, brand title + tagline. Served at `/opengraph-image`.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0F1315",
          color: "#FFFFFF",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          display: "flex",
          flexDirection: "column",
          padding: 80
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              background: "#347F8E",
              color: "#FFFFFF",
              fontSize: 48,
              fontWeight: 800,
              letterSpacing: -2,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            U
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 600,
              color: "#A8B0B3",
              letterSpacing: -0.5
            }}
          >
            Unity Releases
          </div>
        </div>

        <div
          style={{
            marginTop: 80,
            fontSize: 76,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -2.5,
            color: "#FFFFFF",
            display: "flex"
          }}
        >
          Unity 6 release &amp; upgrade intelligence
        </div>

        <div
          style={{
            marginTop: 28,
            fontSize: 30,
            lineHeight: 1.35,
            color: "#A8B0B3",
            maxWidth: 980,
            display: "flex"
          }}
        >
          Diff any two Unity editor versions. Every blocker, breaking change,
          API change, and known issue — bucketed by impact and exportable as
          markdown for an LLM.
        </div>

        <div
          style={{
            marginTop: "auto",
            paddingTop: 40,
            display: "flex",
            alignItems: "center",
            gap: 20,
            fontSize: 22,
            color: "#7A8285"
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              background: "#347F8E",
              borderRadius: 2
            }}
          />
          unityreleases.com — independent project, not affiliated with Unity
          Technologies
        </div>
      </div>
    ),
    size
  );
}
