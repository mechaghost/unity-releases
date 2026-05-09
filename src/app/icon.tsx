import { ImageResponse } from "next/og";

// Force-static so the favicon is built once and cached aggressively.
export const dynamic = "force-static";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * 32×32 PNG favicon — accent-tinted square with a bold "U" wordmark.
 * Served at `/icon` with a content-hash filename; Next.js wires the
 * <link rel="icon"> tag automatically.
 */
export default function Icon() {
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
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: -1,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          borderRadius: 6
        }}
      >
        U
      </div>
    ),
    size
  );
}
