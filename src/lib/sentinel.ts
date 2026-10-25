/** Canonical Sentinel geometry. Every surface uses black on white, never inverse. */
export const SENTINEL_INK = "#111318";
export const SENTINEL_COBALT = "#2455F5";
export const SENTINEL_HEAD = "M28 28 L80 53 H176 L228 28 L213 96 L226 159 L128 220 L30 159 L43 96 Z";
export const SENTINEL_EYES = "M60 91 Q60 86 65 89 L101 110 Q107 113 107 120 V157 Q107 163 101 160 L65 143 Q60 141 60 136 Z M196 91 Q196 86 191 89 L155 110 Q149 113 149 120 V157 Q149 163 155 160 L191 143 Q196 141 196 136 Z";
export const SENTINEL_PUPILS = "M86 111 Q86 108 89 110 L95 114 V143 Q95 147 91 145 L86 142 Z M170 111 Q170 108 167 110 L161 114 V143 Q161 147 165 145 L170 142 Z";
export const SENTINEL_BEAK = "M128 148 L139 166 L128 187 L117 166 Z";

export function sentinelSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" rx="36" fill="#fff"/><path d="${SENTINEL_HEAD}" fill="${SENTINEL_INK}"/><path d="${SENTINEL_EYES}" fill="#fff"/><path d="${SENTINEL_PUPILS}" fill="${SENTINEL_INK}"/><path d="${SENTINEL_BEAK}" fill="#fff"/></svg>`;
}
