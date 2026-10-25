import { SENTINEL_HEAD, SENTINEL_EYES, SENTINEL_PUPILS, SENTINEL_BEAK, SENTINEL_INK } from "@/lib/sentinel";

/** Decorative beside the named home link; fixed fills preserve the owl in dark mode. */
export function SentinelMark({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
      <rect width="256" height="256" rx="36" fill="#FFFFFF" />
      <path d={SENTINEL_HEAD} fill={SENTINEL_INK} />
      <path d={SENTINEL_EYES} fill="#FFFFFF" />
      <path d={SENTINEL_PUPILS} fill={SENTINEL_INK} />
      <path d={SENTINEL_BEAK} fill="#FFFFFF" />
    </svg>
  );
}
