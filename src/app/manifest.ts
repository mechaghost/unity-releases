import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Unity Releases",
    short_name: "Unity Releases",
    description: "Know what changed. Independent Unity release guides and version comparisons.",
    start_url: "/",
    display: "browser",
    background_color: "#FFFFFF",
    theme_color: "#2455F5",
    icons: [192, 512].map(size => ({ src: `/brand/sentinel-${size}.png`, sizes: `${size}x${size}`, type: "image/png", purpose: "any" }))
  };
}
