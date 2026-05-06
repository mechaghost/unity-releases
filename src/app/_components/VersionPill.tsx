import { streamLabel } from "@/lib/stream-labels";

type VersionPillProps = {
  version: string;
  stream?: string | null;
  href?: string | null;
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

export function VersionPill({ version, stream, href }: VersionPillProps) {
  const target = href === undefined ? `/releases/${encodeURIComponent(version)}` : href;
  const mark = streamMark(stream);
  const label = streamLabel(stream);
  if (target) {
    return (
      <a className="chip chip--version" href={target} data-stream={mark} title={`${version}${label ? ` · ${label}` : ""}`}>
        {version}
      </a>
    );
  }
  return (
    <span className="chip chip--version" data-stream={mark} title={`${version}${label ? ` · ${label}` : ""}`}>
      {version}
    </span>
  );
}
