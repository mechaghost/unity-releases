import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * 180×180 PNG for iOS home-screen install. Same accent square as the
 * favicon, just larger so the wordmark stays legible when iOS rounds the
 * corners. Served at `/apple-icon`.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#347F8E",
          color: "#FFFFFF",
          fontSize: 120,
          fontWeight: 800,
          letterSpacing: -4,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        }}
      >
        U
      </div>
    ),
    size
  );
}
