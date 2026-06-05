import { sha256 } from "./hash";

export const DEFAULT_USER_AGENT = "UnityReleasesBot/0.1 (+https://github.com/mechaghost/unity-releases)";

export type FetchedSource = {
  url: string;
  finalUrl: string;
  status: number;
  etag: string | null;
  lastModified: string | null;
  text: string;
  sha256: string;
};

export async function fetchText(
  url: string,
  opts?: { userAgent?: string }
): Promise<FetchedSource> {
  const response = await fetch(url, {
    headers: {
      // Per-call userAgent override takes precedence over the env/default.
      // Needed for hosts (e.g. discussions.unity.com behind Cloudflare)
      // that 403 a non-browser UA.
      "user-agent": opts?.userAgent ?? process.env.INGESTION_USER_AGENT ?? DEFAULT_USER_AGENT,
      accept: "text/html,application/rss+xml,application/xml,text/xml,application/json,text/plain,*/*"
    },
    redirect: "follow"
  });
  const text = await response.text();

  return {
    url,
    finalUrl: response.url,
    status: response.status,
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
    text,
    sha256: sha256(text)
  };
}
