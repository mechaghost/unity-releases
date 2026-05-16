import { streamLabel } from "@/lib/stream-labels";
import { streamInfo } from "@/lib/stream-info";
import { HoverInfo } from "./HoverInfo";

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
  const info = streamInfo(stream);
  const pill = target ? (
    <a className="chip chip--version" href={target} data-stream={mark}>
      {version}
    </a>
  ) : (
    <span className="chip chip--version" data-stream={mark}>
      {version}
    </span>
  );

  if (!info) return pill;

  return (
    <HoverInfo
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
