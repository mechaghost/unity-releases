/**
 * Plain-English explanations for each Unity release stream. Used by the
 * rich hover-info popovers so users hovering an `LTS` / `BETA` / etc.
 * pill see what the label actually promises.
 *
 * Edge-safe: no DB / no React imports — callers can compose with their
 * own UI primitives.
 */

export type StreamInfo = {
  label: string;
  /** One-sentence summary fit for a hover-card body. */
  blurb: string;
  /** When (and when not) to use this stream — practical guidance. */
  guidance: string;
};

const STREAM_INFO: Record<string, StreamInfo> = {
  lts: {
    label: "LTS",
    blurb: "Long-term support: maintained for ~2 years with bug-fix patches.",
    guidance: "Pick this for shipping projects and live games — no feature churn, only fixes."
  },
  stable: {
    label: "Supported",
    blurb: "Supported / Tech stream: latest features, ~6–12 months of support.",
    guidance: "Pick this when you need new features but can absorb a future LTS migration."
  },
  tech: {
    label: "Tech Stream",
    blurb: "Tech stream: latest features, supported for ~6–12 months.",
    guidance: "Pick this when you need new features but can absorb a future LTS migration."
  },
  beta: {
    label: "Beta",
    blurb: "Beta pre-release. Code-complete but known issues outstanding.",
    guidance: "Run against a canary project to spot regressions early — do not ship on this."
  },
  alpha: {
    label: "Alpha",
    blurb: "Alpha pre-release. Experimental, expected to have rough edges.",
    guidance: "Useful only for previewing upcoming features — never for production work."
  }
};

const STREAM_ALIASES: Record<string, keyof typeof STREAM_INFO> = {
  lts: "lts",
  stable: "stable",
  tech: "tech",
  beta: "beta",
  alpha: "alpha",
  supported: "stable",
  "update/supported": "stable",
  preview: "beta"
};

export function streamInfo(stream: string | null | undefined): StreamInfo | null {
  if (!stream) return null;
  const key = STREAM_ALIASES[stream.toLowerCase()];
  return key ? STREAM_INFO[key] : null;
}
