import { streamLabel } from "@/lib/stream-labels";
import { streamInfo } from "@/lib/stream-info";
import { HoverInfo } from "./HoverInfo";

type VersionPillProps = {
  version: string;
  stream?: string | null;
  href?: string | null;
  /**
   * When true, render a slimmer pill with no stream marker and skip
   * the HoverInfo popover. Used for inline mentions inside release-note
   * bodies, where a row often contains 2-3 versions and the per-pill
   * L/B/A markers plus full popover would be visual noise. The hover
   * fallback degrades to a plain `title` attribute.
   */
  compact?: boolean;
  /**
   * Skip the HoverInfo popover while keeping the full pill appearance
   * (stream marker included). Set on /releases, where the stream is already
   * spelled out in the very next column so the popover is redundant - and
   * where 50 Radix roots in one table trigger a Next.js SSR bug that drops
   * one trigger's markup from the HTML while leaving it in the RSC payload.
   * The explanation degrades to a `title` attribute.
   */
  hoverCard?: boolean;
};

const STREAM_MARK: Record<string, string> = {
  lts: "L",
  stable: "U",
  tech: "T",
  beta: "B",
  alpha: "A",
  supported: "U",
  preview: "B"
};

export function streamMark(stream?: string | null): string {
  if (!stream) return "U";
  const key = stream.toLowerCase();
  return STREAM_MARK[key] ?? key.charAt(0).toUpperCase();
}

export function VersionPill({
  version,
  stream,
  href,
  compact = false,
  hoverCard = true
}: VersionPillProps) {
  const target = href === undefined ? `/releases/${encodeURIComponent(version)}` : href;
  const label = streamLabel(stream);

  // Compact rendering: inline-in-text use. No stream marker, no
  // HoverInfo popover - just a slim link with a tooltip title.
  if (compact) {
    const title = `${version}${label ? ` · ${label}` : ""}`;
    const className = "chip chip--version chip--version-compact";
    if (target) {
      return (
        <a className={className} href={target} title={title}>
          {version}
        </a>
      );
    }
    return (
      <span className={className} title={title}>
        {version}
      </span>
    );
  }

  const mark = streamMark(stream);
  const info = streamInfo(stream);
  // Without the popover the explanation has to live somewhere, so fall back
  // to a native tooltip carrying the SAME text the popover would - blurb AND
  // guidance. Dropping guidance here silently lost the actionable half ("never
  // for production work", "do not ship on this") from /releases. No leading
  // version: the pill's own link text already announces it, so repeating it
  // would double-announce on every one of ~50 rows.
  const plainTitle = !hoverCard && info ? `${info.label} — ${info.blurb} ${info.guidance}` : undefined;
  const pill = target ? (
    <a className="chip chip--version" href={target} data-stream={mark} title={plainTitle}>
      {version}
    </a>
  ) : (
    <span className="chip chip--version" data-stream={mark} title={plainTitle}>
      {version}
    </span>
  );

  if (!info || !hoverCard) return pill;

  return (
    <HoverInfo
      // Use asChild here: the pill itself is already a focusable <a>
      // (or a static <span> when href=null). Wrapping it in another
      // focusable span would double the tab stops on dense pages like
      // /releases/[version] where 100+ pills can render.
      asChild
      title={
        <>
          {version}
          {label ? <span className="muted"> · {label}</span> : null}
        </>
      }
      body={
        <>
          <p>{info.blurb}</p>
          <p className="muted">{info.guidance}</p>
        </>
      }
    >
      {pill}
    </HoverInfo>
  );
}
