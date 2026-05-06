const STREAM_LABELS: Record<string, string> = {
  "Update/Supported": "Supported",
  beta: "Beta",
  alpha: "Alpha",
  patch: "Patch"
};

export function streamLabel(stream: string | null | undefined): string {
  if (!stream) return "";
  return STREAM_LABELS[stream] ?? stream;
}

export function streamListLabel(streams: readonly string[]): string {
  return streams.map(streamLabel).join(" + ");
}
