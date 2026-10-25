import { ImageResponse } from "next/og";
import { SentinelMark } from "./_components/SentinelMark";

export const dynamic = "force-static";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<SentinelMark size={32} />, size);
}
